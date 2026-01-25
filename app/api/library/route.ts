import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles, audioFiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getVoiceName } from "@/lib/voice-names";

export async function GET() {
  try {
    // Get all articles with their audio files
    const allArticles = await db
      .select()
      .from(articles)
      .orderBy(desc(articles.createdAt));

    // For each article, get its audio files
    const articlesWithAudio = await Promise.all(
      allArticles.map(async (article) => {
        const audio = await db
          .select()
          .from(audioFiles)
          .where(eq(audioFiles.articleId, article.id))
          .orderBy(desc(audioFiles.createdAt));

        // Parse categories and tags from JSON cache
        const categories = article.categoriesJson
          ? JSON.parse(article.categoriesJson)
          : [];
        const tags = article.tagsJson
          ? JSON.parse(article.tagsJson)
          : [];

        return {
          id: article.id,
          title: article.title,
          wordCount: article.wordCount || 0,
          sourceType: article.sourceType,
          sourceUrl: article.sourceUrl,
          imageUrl: article.imageUrl,
          generatedImageUrl: article.generatedImageUrl,
          imageGenerationStatus: article.imageGenerationStatus,
          categories,
          tags,
          categorizationStatus: article.categorizationStatus || "pending",
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
          audioFiles: audio.map((a) => ({
            id: a.id,
            voiceId: a.voiceId,
            voiceName: getVoiceName(a.voiceId),
            blobUrl: a.blobUrl,
            duration: a.duration,
            fileSize: a.fileSize,
            status: a.status,
            createdAt: a.createdAt,
          })),
        };
      })
    );

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
