import { NextResponse } from "next/server";
import { getVoices } from "@/lib/api/elevenlabs";
import { db } from "@/lib/db/client";
import { voices } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    // Check if we have recent cached voices (less than 1 hour old)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const cachedVoices = await db
      .select()
      .from(voices)
      .where(sql`${voices.lastFetched} > ${oneHourAgo.getTime() / 1000}`);

    // If we have cached voices, return them
    if (cachedVoices.length > 0) {
      return NextResponse.json({
        success: true,
        voices: cachedVoices.map((v) => ({
          id: v.id,
          name: v.name,
          category: v.category,
          previewUrl: v.previewUrl,
          labels: v.labels ? JSON.parse(v.labels) : {},
          isFavorite: v.isFavorite,
        })),
        cached: true,
      });
    }

    // Otherwise, fetch from ElevenLabs
    const response = await getVoices();

    // Store in database
    const now = new Date();
    for (const voice of response.voices) {
      await db
        .insert(voices)
        .values({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category || null,
          previewUrl: voice.preview_url || null,
          labels: voice.labels ? JSON.stringify(voice.labels) : null,
          isFavorite: 0,
          lastFetched: now,
        })
        .onConflictDoUpdate({
          target: voices.id,
          set: {
            name: voice.name,
            category: voice.category || null,
            previewUrl: voice.preview_url || null,
            labels: voice.labels ? JSON.stringify(voice.labels) : null,
            lastFetched: now,
          },
        });
    }

    return NextResponse.json({
      success: true,
      voices: response.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        previewUrl: v.preview_url,
        labels: v.labels || {},
        isFavorite: false,
      })),
      cached: false,
    });
  } catch (error) {
    console.error("Voices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
