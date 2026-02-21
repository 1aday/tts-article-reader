import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { articles, audioFiles } from "@/lib/db/schema";

export type SeoArticleRecord = {
  id: number;
  title: string;
  originalText: string;
  sourceUrl: string | null;
  updatedAt: Date | null;
  imageUrl: string | null;
  generatedImageUrl: string | null;
};

export async function getArticleSeoRecordById(articleId: number): Promise<SeoArticleRecord | null> {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      originalText: articles.originalText,
      sourceUrl: articles.sourceUrl,
      updatedAt: articles.updatedAt,
      imageUrl: articles.imageUrl,
      generatedImageUrl: articles.generatedImageUrl,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  return article ?? null;
}

export async function getArticleSeoRecordByAudioId(audioId: number): Promise<SeoArticleRecord | null> {
  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      originalText: articles.originalText,
      sourceUrl: articles.sourceUrl,
      updatedAt: articles.updatedAt,
      imageUrl: articles.imageUrl,
      generatedImageUrl: articles.generatedImageUrl,
    })
    .from(audioFiles)
    .innerJoin(articles, eq(audioFiles.articleId, articles.id))
    .where(eq(audioFiles.id, audioId))
    .limit(1);

  return row ?? null;
}
