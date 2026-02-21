import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { audioFiles, voices } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getVoiceName, isDisplayVoiceName } from "@/lib/voice-names";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const articleIdNum = parseInt(articleId);

    // Get all audio files for this article, ordered by creation date (newest first)
    const audioFilesList = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.articleId, articleIdNum))
      .orderBy(desc(audioFiles.createdAt));

    const uniqueVoiceIds = Array.from(new Set(audioFilesList.map((audio) => audio.voiceId)));
    const voiceRows = uniqueVoiceIds.length
      ? await db
          .select({ id: voices.id, name: voices.name })
          .from(voices)
          .where(inArray(voices.id, uniqueVoiceIds))
      : [];
    const voiceNameById = new Map(voiceRows.map((row) => [row.id, row.name]));

    return NextResponse.json(
      audioFilesList.map((audio) => {
        const dbVoiceName = voiceNameById.get(audio.voiceId)?.trim();
        const fallbackVoiceName = isDisplayVoiceName(dbVoiceName, audio.voiceId)
          ? dbVoiceName
          : getVoiceName(audio.voiceId);

        return {
          ...audio,
          voiceName: isDisplayVoiceName(audio.voiceName, audio.voiceId)
            ? audio.voiceName!.trim()
            : fallbackVoiceName,
        };
      })
    );
  } catch (error) {
    console.error("Audio list fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio list" },
      { status: 500 }
    );
  }
}
