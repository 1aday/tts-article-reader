const MPEG_SYNC_MASK = 0xffe00000 >>> 0;
const MPEG_SYNC_VALUE = 0xffe00000 >>> 0;

const BITRATES_MPEG1_LAYER3_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96,
  112, 128, 160, 192, 224, 256, 320, 0,
];

const BITRATES_MPEG2_LAYER3_KBPS = [
  0, 8, 16, 24, 32, 40, 48, 56,
  64, 80, 96, 112, 128, 144, 160, 0,
];

const SAMPLE_RATES_MPEG1 = [44100, 48000, 32000, 0];
const SAMPLE_RATES_MPEG2 = [22050, 24000, 16000, 0];
const SAMPLE_RATES_MPEG25 = [11025, 12000, 8000, 0];

interface Mp3FrameHeader {
  frameLength: number;
  sideInfoLength: number;
  sampleRate: number;
  samplesPerFrame: number;
}

function isValidSynchsafeByte(value: number): boolean {
  return (value & 0x80) === 0;
}

function stripLeadingId3Tags(buffer: Buffer): Buffer {
  let offset = 0;

  while (offset + 10 <= buffer.length) {
    if (buffer.toString("ascii", offset, offset + 3) !== "ID3") {
      break;
    }

    const versionMajor = buffer[offset + 3];
    const flags = buffer[offset + 5];
    const sizeBytes = buffer.subarray(offset + 6, offset + 10);

    const isValidVersion = versionMajor >= 2 && versionMajor <= 4;
    const hasValidSize = [...sizeBytes].every((byte) => isValidSynchsafeByte(byte));
    if (!isValidVersion || !hasValidSize) {
      break;
    }

    const tagBodySize =
      (sizeBytes[0] << 21)
      | (sizeBytes[1] << 14)
      | (sizeBytes[2] << 7)
      | sizeBytes[3];
    const hasFooter = (flags & 0x10) !== 0;
    const tagSize = 10 + tagBodySize + (hasFooter ? 10 : 0);

    if (tagSize <= 0 || offset + tagSize > buffer.length) {
      break;
    }

    offset += tagSize;
  }

  return buffer.subarray(offset);
}

function stripTrailingId3v1Tag(buffer: Buffer): Buffer {
  if (buffer.length < 128) return buffer;
  if (buffer.toString("ascii", buffer.length - 128, buffer.length - 125) !== "TAG") {
    return buffer;
  }
  return buffer.subarray(0, buffer.length - 128);
}

function parseFrameHeader(buffer: Buffer, offset: number): Mp3FrameHeader | null {
  if (offset + 4 > buffer.length) return null;

  const header = buffer.readUInt32BE(offset);
  if (((header & MPEG_SYNC_MASK) >>> 0) !== MPEG_SYNC_VALUE) {
    return null;
  }

  const versionBits = (header >> 19) & 0b11;
  const layerBits = (header >> 17) & 0b11;
  const bitrateIndex = (header >> 12) & 0b1111;
  const sampleRateIndex = (header >> 10) & 0b11;
  const padding = (header >> 9) & 0b1;
  const channelMode = (header >> 6) & 0b11;

  // versionBits === 0b01 is reserved. layerBits === 0b01 is Layer III.
  if (versionBits === 0b01 || layerBits !== 0b01) return null;
  if (bitrateIndex === 0 || bitrateIndex === 0b1111) return null;
  if (sampleRateIndex === 0b11) return null;

  const isMpeg1 = versionBits === 0b11;
  const bitrateKbps = isMpeg1
    ? BITRATES_MPEG1_LAYER3_KBPS[bitrateIndex]
    : BITRATES_MPEG2_LAYER3_KBPS[bitrateIndex];

  const sampleRate = versionBits === 0b11
    ? SAMPLE_RATES_MPEG1[sampleRateIndex]
    : versionBits === 0b10
      ? SAMPLE_RATES_MPEG2[sampleRateIndex]
      : SAMPLE_RATES_MPEG25[sampleRateIndex];

  if (!bitrateKbps || !sampleRate) return null;

  const coefficient = isMpeg1 ? 144 : 72;
  const frameLength = Math.floor((coefficient * bitrateKbps * 1000) / sampleRate) + padding;
  if (frameLength <= 0 || offset + frameLength > buffer.length) return null;

  const isMono = channelMode === 0b11;
  const sideInfoLength = isMpeg1
    ? (isMono ? 17 : 32)
    : (isMono ? 9 : 17);

  return {
    frameLength,
    sideInfoLength,
    sampleRate,
    samplesPerFrame: isMpeg1 ? 1152 : 576,
  };
}

function hasVbrMetadataFrame(buffer: Buffer, header: Mp3FrameHeader): boolean {
  const xingOffset = 4 + header.sideInfoLength;
  if (xingOffset + 4 <= buffer.length) {
    const marker = buffer.toString("ascii", xingOffset, xingOffset + 4);
    if (marker === "Xing" || marker === "Info") {
      return true;
    }
  }

  // VBRI marker is fixed 32 bytes after the MPEG header.
  const vbriOffset = 4 + 32;
  if (vbriOffset + 4 <= buffer.length) {
    const marker = buffer.toString("ascii", vbriOffset, vbriOffset + 4);
    if (marker === "VBRI") {
      return true;
    }
  }

  return false;
}

export function normalizeMp3Chunk(buffer: Buffer): Buffer {
  let normalized = stripLeadingId3Tags(buffer);
  normalized = stripTrailingId3v1Tag(normalized);

  const header = parseFrameHeader(normalized, 0);
  if (!header) {
    return normalized;
  }

  const firstFrame = normalized.subarray(0, header.frameLength);
  if (hasVbrMetadataFrame(firstFrame, header)) {
    return normalized.subarray(header.frameLength);
  }

  return normalized;
}

export function mergeMp3Chunks(chunks: Buffer[]): Buffer {
  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  const normalizedChunks = chunks
    .map(normalizeMp3Chunk)
    .filter((chunk) => chunk.length > 0);

  return Buffer.concat(normalizedChunks);
}

export function getMp3DurationSeconds(buffer: Buffer): number {
  if (buffer.length === 0) {
    return 0;
  }

  let normalized = stripLeadingId3Tags(buffer);
  normalized = stripTrailingId3v1Tag(normalized);

  if (normalized.length < 4) {
    return 0;
  }

  let offset = 0;
  let durationSeconds = 0;
  let hasSynced = false;

  while (offset + 4 <= normalized.length) {
    const header = parseFrameHeader(normalized, offset);

    if (!header) {
      if (hasSynced) {
        break;
      }
      offset += 1;
      continue;
    }

    hasSynced = true;
    durationSeconds += header.samplesPerFrame / header.sampleRate;
    offset += header.frameLength;
  }

  return hasSynced && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : 0;
}
