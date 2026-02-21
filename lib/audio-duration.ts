const DEFAULT_MP3_BITRATE_KBPS = 128;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;

const clampToNonNegative = (value: number) => Math.max(0, value);

export function estimateMp3DurationSeconds(
  fileSizeBytes: number | null | undefined,
  bitrateKbps = DEFAULT_MP3_BITRATE_KBPS,
): number {
  if (!Number.isFinite(fileSizeBytes) || !fileSizeBytes || fileSizeBytes <= 0) {
    return 0;
  }
  if (!Number.isFinite(bitrateKbps) || bitrateKbps <= 0) {
    return 0;
  }

  const duration = (fileSizeBytes * 8) / (bitrateKbps * 1000);
  return clampToNonNegative(duration);
}

export function resolveAudioDurationSeconds(
  durationSeconds: number | null | undefined,
  fileSizeBytes: number | null | undefined,
): number {
  if (Number.isFinite(durationSeconds) && (durationSeconds ?? 0) > 0) {
    return clampToNonNegative(durationSeconds as number);
  }

  return estimateMp3DurationSeconds(fileSizeBytes);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const remainingSeconds = totalSeconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
