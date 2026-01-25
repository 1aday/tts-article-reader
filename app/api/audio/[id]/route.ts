import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { audioFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { getAudioPath, deleteAudio } from "@/lib/storage/blob-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const audioId = parseInt(id);

    // Get audio file from database
    const [audioFile] = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, audioId));

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      );
    }

    // Return metadata for client-side player
    return NextResponse.json({
      id: audioFile.id,
      blobUrl: audioFile.blobUrl,
      duration: audioFile.duration,
      fileSize: audioFile.fileSize,
      voiceName: audioFile.voiceName,
    });
  } catch (error) {
    console.error("Audio fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const audioId = parseInt(id);

    // Get audio file from database
    const [audioFile] = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, audioId));

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      );
    }

    // Delete physical file from storage
    if (audioFile.blobUrl) {
      await deleteAudio(audioFile.blobUrl);
    }

    // Delete database record
    await db.delete(audioFiles).where(eq(audioFiles.id, audioId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Audio deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete audio" },
      { status: 500 }
    );
  }
}
