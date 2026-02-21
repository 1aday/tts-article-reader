import { isIP } from "node:net";
import sharp from "sharp";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_MAX_BYTES = 300 * 1024;

const OG_DETAIL_SCALE_STEPS = [1, 0.9, 0.82] as const;
const OG_JPEG_QUALITY_STEPS = [82, 76, 70, 64, 58, 52, 46] as const;
const REMOTE_IMAGE_TIMEOUT_MS = 6_500;
const MAX_REMOTE_INPUT_BYTES = 20 * 1024 * 1024;

type ArticleOgImageInput = {
  title: string;
  sourceImageUrl?: string | null;
  sourceHost?: string | null;
};

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toSingleLine = (value: string) => value.replace(/\s+/g, " ").trim();

const wrapText = (input: string, maxCharsPerLine: number, maxLines: number): string[] => {
  const words = toSingleLine(input).split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    if (tentative.length <= maxCharsPerLine) {
      currentLine = tentative;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      if (lines.length === maxLines) return lines;
      currentLine = word;
      continue;
    }

    lines.push(word.slice(0, maxCharsPerLine));
    if (lines.length === maxLines) return lines;
    currentLine = word.slice(maxCharsPerLine);
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  return lines;
};

const getHostFromUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const isDisallowedIpv4 = (host: string): boolean => {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
};

const isDisallowedIpv6 = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
};

const isSafeRemoteImageUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost") return false;

  const ipVersion = isIP(host);
  if (ipVersion === 4 && isDisallowedIpv4(host)) return false;
  if (ipVersion === 6 && isDisallowedIpv6(host)) return false;

  return true;
};

const encodeCompliantJpeg = async (raster: Buffer): Promise<Buffer> => {
  let bestCandidate: Buffer | null = null;

  for (const scale of OG_DETAIL_SCALE_STEPS) {
    let base = sharp(raster)
      .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      });

    if (scale < 1) {
      const downscaleWidth = Math.max(720, Math.round(OG_IMAGE_WIDTH * scale));
      const downscaleHeight = Math.max(378, Math.round(OG_IMAGE_HEIGHT * scale));

      base = sharp(raster)
        .resize(downscaleWidth, downscaleHeight, {
          fit: "fill",
          kernel: sharp.kernel.lanczos3,
        })
        .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
          fit: "fill",
          kernel: sharp.kernel.cubic,
        });
    }

    for (const quality of OG_JPEG_QUALITY_STEPS) {
      const candidate = await base
        .clone()
        .jpeg({
          quality,
          mozjpeg: true,
          progressive: true,
          chromaSubsampling: "4:2:0",
        })
        .toBuffer();

      if (!bestCandidate || candidate.length < bestCandidate.length) {
        bestCandidate = candidate;
      }

      if (candidate.length <= OG_IMAGE_MAX_BYTES) {
        return candidate;
      }
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  throw new Error("Failed to produce OG image");
};

const buildDefaultBackdrop = async (): Promise<Buffer> => {
  const svg = `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1424"/>
      <stop offset="52%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.18" cy="0.16" r="0.5">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.84" cy="0.9" r="0.52">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glowA)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glowB)" />
</svg>
`;

  return sharp(Buffer.from(svg))
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)
    .png()
    .toBuffer();
};

const buildBackdropFromCover = async (sourceImageBuffer: Buffer): Promise<Buffer> => {
  const source = sharp(sourceImageBuffer, { failOn: "none" }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 1;
  const aspectRatio = width / height;

  if (aspectRatio >= 1.35 && aspectRatio <= 2.4) {
    return source
      .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
        fit: "cover",
        position: "attention",
      })
      .modulate({ saturation: 1.06, brightness: 0.96 })
      .png()
      .toBuffer();
  }

  const blurredBackdrop = await source
    .clone()
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
      fit: "cover",
      position: "attention",
    })
    .blur(16)
    .modulate({ saturation: 1.12, brightness: 0.66 })
    .png()
    .toBuffer();

  const cardSize = 500;
  const cardLeft = Math.round((OG_IMAGE_WIDTH - cardSize) / 2);
  const cardTop = Math.round((OG_IMAGE_HEIGHT - cardSize) / 2);

  const foregroundCard = await source
    .clone()
    .resize(cardSize, cardSize, {
      fit: "contain",
      background: { r: 9, g: 12, b: 18, alpha: 1 },
    })
    .png()
    .toBuffer();

  const chromeSvg = `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.15)"/>
    </linearGradient>
  </defs>
  <rect x="${cardLeft}" y="${cardTop}" width="${cardSize}" height="${cardSize}" rx="24" fill="rgba(5,7,12,0.58)" stroke="url(#cardStroke)" stroke-width="2"/>
</svg>
`;

  return sharp(blurredBackdrop)
    .composite([
      {
        input: foregroundCard,
        left: cardLeft,
        top: cardTop,
      },
      {
        input: Buffer.from(chromeSvg),
      },
    ])
    .png()
    .toBuffer();
};

const fetchRemoteImage = async (sourceImageUrl: string | null | undefined): Promise<Buffer | null> => {
  if (!isSafeRemoteImageUrl(sourceImageUrl)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(sourceImageUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "TTSReaderOGBot/1.0",
        Accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8,*/*;q=0.2",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const contentLengthRaw = response.headers.get("content-length");
    if (contentLengthRaw) {
      const contentLength = Number.parseInt(contentLengthRaw, 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_INPUT_BYTES) {
        return null;
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0 || buffer.length > MAX_REMOTE_INPUT_BYTES) {
      return null;
    }

    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const buildArticleOverlay = (title: string, sourceHost?: string | null): Buffer => {
  const lines = wrapText(title, 42, 3);
  const safeTitleLines = lines.map(escapeSvgText);
  const safeHost = escapeSvgText(sourceHost ? sourceHost : "Shared from TTS Reader");
  const titleStartY = safeTitleLines.length > 2 ? 428 : 446;
  const lineHeight = 56;

  const textNodes = safeTitleLines
    .map(
      (line, index) =>
        `<text x="92" y="${titleStartY + index * lineHeight}" fill="white" font-size="50" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="780">${line}</text>`
    )
    .join("");

  const svg = `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.04)"/>
      <stop offset="48%" stop-color="rgba(3,6,12,0.3)"/>
      <stop offset="100%" stop-color="rgba(2,4,9,0.84)"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(5,8,14,0.78)"/>
      <stop offset="100%" stop-color="rgba(6,10,17,0.9)"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#shade)" />
  <rect x="72" y="330" width="1056" height="248" rx="28" fill="url(#panel)" stroke="rgba(255,255,255,0.18)" />
  <rect x="72" y="74" width="320" height="44" rx="22" fill="rgba(6,10,17,0.6)" stroke="rgba(255,255,255,0.25)" />
  <circle cx="100" cy="96" r="8" fill="url(#accent)" />
  <text x="118" y="104" fill="rgba(255,255,255,0.9)" font-size="20" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="700" letter-spacing="1.1">TTS READER ARTICLE</text>
  ${textNodes}
  <text x="92" y="548" fill="rgba(255,255,255,0.72)" font-size="26" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="500">${safeHost}</text>
</svg>
`;

  return Buffer.from(svg);
};

export async function buildArticleOgImage({
  title,
  sourceImageUrl,
  sourceHost,
}: ArticleOgImageInput): Promise<Buffer> {
  const cleanTitle = toSingleLine(title || "TTS Reader Article") || "TTS Reader Article";
  const host = sourceHost ? sourceHost : getHostFromUrl(sourceImageUrl);

  const remoteImage = await fetchRemoteImage(sourceImageUrl);
  const backdrop = remoteImage
    ? await buildBackdropFromCover(remoteImage)
    : await buildDefaultBackdrop();

  const composed = await sharp(backdrop)
    .composite([{ input: buildArticleOverlay(cleanTitle, host) }])
    .png()
    .toBuffer();

  return encodeCompliantJpeg(composed);
}

export async function buildHomeOgImage(): Promise<Buffer> {
  const svg = `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="48%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.2" cy="0.12" r="0.44">
      <stop offset="0%" stop-color="#fb923c" stop-opacity="0.43"/>
      <stop offset="100%" stop-color="#fb923c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.82" cy="0.88" r="0.52">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.48"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(5,8,14,0.76)"/>
      <stop offset="100%" stop-color="rgba(6,10,17,0.92)"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glowA)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glowB)" />

  <rect x="72" y="72" width="1056" height="486" rx="36" fill="url(#panel)" stroke="rgba(255,255,255,0.18)" />
  <rect x="104" y="110" width="262" height="46" rx="23" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.24)" />
  <circle cx="131" cy="133" r="9" fill="url(#accent)" />
  <text x="151" y="141" fill="rgba(255,255,255,0.9)" font-size="20" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="700" letter-spacing="1.1">TTS READER</text>

  <text x="104" y="238" fill="white" font-size="78" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="800">Turn Articles Into</text>
  <text x="104" y="318" fill="white" font-size="78" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="800">Cinematic Audio</text>
  <text x="104" y="380" fill="rgba(255,255,255,0.78)" font-size="34" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="500">AI voices, custom style, instant playback.</text>

  <rect x="104" y="430" width="386" height="56" rx="14" fill="rgba(255,255,255,0.08)" />
  <text x="132" y="468" fill="rgba(255,255,255,0.93)" font-size="27" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="650">Create. Generate. Listen.</text>

  <rect x="852" y="176" width="198" height="276" rx="24" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)"/>
  <rect x="808" y="212" width="198" height="276" rx="24" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)"/>
  <rect x="764" y="248" width="198" height="276" rx="24" fill="url(#accent)" opacity="0.88"/>
</svg>
`;

  const raster = await sharp(Buffer.from(svg))
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)
    .png()
    .toBuffer();

  return encodeCompliantJpeg(raster);
}
