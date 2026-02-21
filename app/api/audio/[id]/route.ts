import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { audioFiles, voices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteAudio } from "@/lib/storage/blob-storage";
import { getVoiceName, isDisplayVoiceName } from "@/lib/voice-names";
import { resolveAudioDurationSeconds } from "@/lib/audio-duration";

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

    let displayVoiceName = isDisplayVoiceName(audioFile.voiceName, audioFile.voiceId)
      ? audioFile.voiceName!.trim()
      : "";

    if (!displayVoiceName) {
      const [voiceRecord] = await db
        .select({ name: voices.name })
        .from(voices)
        .where(eq(voices.id, audioFile.voiceId))
        .limit(1);

      const dbVoiceName = voiceRecord?.name?.trim();
      displayVoiceName = isDisplayVoiceName(dbVoiceName, audioFile.voiceId)
        ? dbVoiceName
        : getVoiceName(audioFile.voiceId);
    }

    // Return metadata for client-side player
    const resolvedDuration = resolveAudioDurationSeconds(audioFile.duration, audioFile.fileSize);

    return NextResponse.json({
      id: audioFile.id,
      articleId: audioFile.articleId,
      voiceId: audioFile.voiceId,
      blobUrl: audioFile.blobUrl,
      duration: resolvedDuration,
      fileSize: audioFile.fileSize,
      voiceName: displayVoiceName,
      status: audioFile.status,
      createdAt: audioFile.createdAt,
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
