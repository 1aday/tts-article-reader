import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles, audioFiles, voices } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import { getVoiceName, isDisplayVoiceName } from "@/lib/voice-names";

const parseJsonArray = (value: string | null): string[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export async function GET() {
  try {
    // Fetch only fields needed by the library UI to keep response generation fast.
    const allArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        wordCount: articles.wordCount,
        sourceType: articles.sourceType,
        sourceUrl: articles.sourceUrl,
        imageUrl: articles.imageUrl,
        generatedImageUrl: articles.generatedImageUrl,
        imageGenerationStatus: articles.imageGenerationStatus,
        categoriesJson: articles.categoriesJson,
        tagsJson: articles.tagsJson,
        categorizationStatus: articles.categorizationStatus,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .orderBy(desc(articles.createdAt));

    const voiceRows = await db
      .select({ id: voices.id, name: voices.name })
      .from(voices);
    const voiceNameById = new Map(voiceRows.map((row) => [row.id, row.name]));

    const articleIds = allArticles.map((article) => article.id);
    const allAudio = articleIds.length
      ? await db
          .select({
            id: audioFiles.id,
            articleId: audioFiles.articleId,
            voiceId: audioFiles.voiceId,
            voiceName: audioFiles.voiceName,
            blobUrl: audioFiles.blobUrl,
            duration: audioFiles.duration,
            fileSize: audioFiles.fileSize,
            status: audioFiles.status,
            createdAt: audioFiles.createdAt,
          })
          .from(audioFiles)
          .where(inArray(audioFiles.articleId, articleIds))
          .orderBy(desc(audioFiles.createdAt))
      : [];

    const audioByArticleId = new Map<number, typeof allAudio>();
    for (const audio of allAudio) {
      const existing = audioByArticleId.get(audio.articleId);
      if (existing) {
        existing.push(audio);
      } else {
        audioByArticleId.set(audio.articleId, [audio]);
      }
    }

    const articlesWithAudio = allArticles.map((article) => ({
      id: article.id,
      title: article.title,
      wordCount: article.wordCount || 0,
      sourceType: article.sourceType,
      sourceUrl: article.sourceUrl,
      imageUrl: article.imageUrl,
      generatedImageUrl: article.generatedImageUrl,
      imageGenerationStatus: article.imageGenerationStatus,
      categories: parseJsonArray(article.categoriesJson),
      tags: parseJsonArray(article.tagsJson),
      categorizationStatus: article.categorizationStatus || "pending",
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      audioFiles: (audioByArticleId.get(article.id) || []).map((audio) => {
        const dbVoiceName = voiceNameById.get(audio.voiceId)?.trim();
        const fallbackVoiceName = isDisplayVoiceName(dbVoiceName, audio.voiceId)
          ? dbVoiceName
          : getVoiceName(audio.voiceId);

        return {
          id: audio.id,
          voiceId: audio.voiceId,
          voiceName: isDisplayVoiceName(audio.voiceName, audio.voiceId)
            ? audio.voiceName.trim()
            : fallbackVoiceName,
          blobUrl: audio.blobUrl,
          duration: audio.duration,
          fileSize: audio.fileSize,
          status: audio.status,
          createdAt: audio.createdAt,
        };
      }),
    }));

    return NextResponse.json({
      success: true,
      articles: articlesWithAudio,
    });
  } catch (error) {
    console.error("Library fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch library" },
      { status: 500 }
    );
  }
}
