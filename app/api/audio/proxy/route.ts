import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, constants } from "node:fs";
import { Readable } from "node:stream";
import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

interface ParsedRange {
  start: number;
  end: number;
}

const REMUX_CACHE_DIR = join(tmpdir(), "tts-audio-proxy-remux-cache");
const remuxInFlight = new Map<string, Promise<string | null>>();

function parseRange(rangeHeader: string, fileSize: number): ParsedRange | null {
  const [firstRangePart] = rangeHeader.split(",");
  const normalizedRange = firstRangePart.trim();
  const match = /^bytes=(\d*)-(\d*)$/.exec(normalizedRange);
  if (!match) return null;

  const [, startText, endText] = match;
  const hasStart = startText.length > 0;
  const hasEnd = endText.length > 0;

  if (!hasStart && !hasEnd) return null;

  let start = hasStart ? Number.parseInt(startText, 10) : 0;
  let end = hasEnd ? Number.parseInt(endText, 10) : fileSize - 1;

  if ((!hasStart && hasEnd) || startText === "") {
    const suffixLength = Number.parseInt(endText, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < 0 ||
    start > end ||
    start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", (error) => reject(error));
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim() || "unknown error"}`));
    });
  });
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureRemuxedCacheFile(upstreamUrl: string): Promise<string | null> {
  const cacheKey = createHash("sha1").update(upstreamUrl).digest("hex");
  const cachePath = join(REMUX_CACHE_DIR, `${cacheKey}.mp3`);

  if (await fileExists(cachePath)) {
    return cachePath;
  }

  const existing = remuxInFlight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    const tempPath = join(REMUX_CACHE_DIR, `${cacheKey}-${randomUUID()}.tmp.mp3`);
    try {
      await mkdir(REMUX_CACHE_DIR, { recursive: true });

      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        upstreamUrl,
        "-c",
        "copy",
        tempPath,
      ]);

      await rename(tempPath, cachePath);
      return cachePath;
    } catch (error) {
      console.warn("[Audio proxy] Failed to remux upstream audio, using passthrough.", error);
      await rm(tempPath, { force: true }).catch(() => {});
      return null;
    } finally {
      remuxInFlight.delete(cacheKey);
    }
  })();

  remuxInFlight.set(cacheKey, task);
  return task;
}

function withCorsHeaders(headers: Headers): Headers {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Range");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return headers;
}

async function serveCachedFile(filepath: string, rangeHeader: string | null) {
  const fileStats = await stat(filepath);
  const fileSize = fileStats.size;

  const baseHeaders = withCorsHeaders(new Headers({
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  }));

  if (rangeHeader) {
    const parsedRange = parseRange(rangeHeader, fileSize);
    if (!parsedRange) {
      return new NextResponse(null, {
        status: 416,
        headers: withCorsHeaders(new Headers({
          ...Object.fromEntries(baseHeaders.entries()),
          "Content-Range": `bytes */${fileSize}`,
        })),
      });
    }

    const { start, end } = parsedRange;
    const chunkLength = end - start + 1;
    const stream = createReadStream(filepath, { start, end });

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: withCorsHeaders(new Headers({
        ...Object.fromEntries(baseHeaders.entries()),
        "Content-Length": chunkLength.toString(),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      })),
    });
  }

  const stream = createReadStream(filepath);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: withCorsHeaders(new Headers({
      ...Object.fromEntries(baseHeaders.entries()),
      "Content-Length": fileSize.toString(),
    })),
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  try {
    const upstreamUrl = rawUrl.startsWith("/")
      ? `${request.nextUrl.origin}${rawUrl}`
      : rawUrl;
    const range = request.headers.get("range");

    // For remote MP3 URLs, proactively remux once and serve from a local byte-range cache.
    if (upstreamUrl.startsWith("http://") || upstreamUrl.startsWith("https://")) {
      const remuxedPath = await ensureRemuxedCacheFile(upstreamUrl);
      if (remuxedPath) {
        return serveCachedFile(remuxedPath, range);
      }
    }

    const upstreamHeaders = new Headers();
    if (range) {
      upstreamHeaders.set("range", range);
    }

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => "");
      const responseHeaders = withCorsHeaders(new Headers({
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      }));

      return new NextResponse(
        errorPayload || JSON.stringify({ error: "Failed to fetch audio file" }),
        {
          status: response.status,
          headers: responseHeaders,
        }
      );
    }

    const responseHeaders = new Headers();
    const passthroughHeaderNames = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
    ];

    for (const headerName of passthroughHeaderNames) {
      const headerValue = response.headers.get(headerName);
      if (headerValue) {
        responseHeaders.set(headerName, headerValue);
      }
    }

    if (!responseHeaders.has("content-type")) {
      responseHeaders.set("content-type", "audio/mpeg");
    }
    if (!responseHeaders.has("accept-ranges")) {
      responseHeaders.set("accept-ranges", "bytes");
    }
    if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("cache-control", "public, max-age=3600");
    }

    withCorsHeaders(responseHeaders);

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio file" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: withCorsHeaders(new Headers()) });
}
