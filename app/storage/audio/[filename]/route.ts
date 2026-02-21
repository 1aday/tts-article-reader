import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getAudioPath } from "@/lib/storage/blob-storage";

interface ParsedRange {
  start: number;
  end: number;
}

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
    // Suffix form: bytes=-500 means the last 500 bytes.
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filepath = getAudioPath(filename);
    const fileBuffer = await readFile(filepath);
    const fileSize = fileBuffer.length;
    const rangeHeader = request.headers.get("range");

    const baseHeaders = {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };

    if (rangeHeader) {
      const parsedRange = parseRange(rangeHeader, fileSize);
      if (!parsedRange) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const { start, end } = parsedRange;
      const chunk = fileBuffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": chunk.length.toString(),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        },
      });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": fileSize.toString(),
      },
    });
  } catch (error) {
    console.error("Audio file fetch error:", error);
    return NextResponse.json(
      { error: "Audio file not found" },
      { status: 404 }
    );
  }
}
