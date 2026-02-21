import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { audioFiles, articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteAudio } from "@/lib/storage/blob-storage";
import { z } from "zod";
import { DEFAULT_VOICE_AUDIO_SETTINGS } from "@/lib/audio-settings";

const regenerateSchema = z.object({
  voiceId: z.string(),
  deleteOld: z.boolean().optional().default(false),
  stability: z.number().min(0).max(1).optional().default(DEFAULT_VOICE_AUDIO_SETTINGS.stability),
  similarityBoost: z.number().min(0).max(1).optional().default(DEFAULT_VOICE_AUDIO_SETTINGS.similarityBoost),
  style: z.number().min(0).max(1).optional().default(DEFAULT_VOICE_AUDIO_SETTINGS.style),
  useSpeakerBoost: z.boolean().optional().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const audioId = parseInt(id);

    // Parse request body
    const body = await request.json();
    const validation = regenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { voiceId, deleteOld, ...voiceSettings } = validation.data;

    // Get current audio file
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

    // Get article
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, audioFile.articleId));

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Delete old audio if requested
    if (deleteOld) {
      if (audioFile.blobUrl) {
        await deleteAudio(audioFile.blobUrl);
      }
      await db.delete(audioFiles).where(eq(audioFiles.id, audioId));
    }

    // Return article info and settings for client to call /api/generate
    return NextResponse.json({
      success: true,
      articleId: article.id,
      voiceId,
      voiceSettings,
      oldAudioDeleted: deleteOld,
    });
  } catch (error) {
    console.error("Regeneration error:", error);
    return NextResponse.json(
      { error: "Failed to prepare regeneration" },
      { status: 500 }
    );
  }
}
