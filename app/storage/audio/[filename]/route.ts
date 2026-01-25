import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getAudioPath } from "@/lib/storage/blob-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filepath = getAudioPath(filename);
    const fileBuffer = await readFile(filepath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": fileBuffer.length.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Audio file not found" },
      { status: 404 }
    );
  }
}
