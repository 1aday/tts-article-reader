import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateImage } from "@/lib/api/replicate";
import { buildImagePrompt } from "@/lib/utils/image-generation";

export const maxDuration = 300; // 5 minutes for image generation

export async function POST(req: NextRequest) {
  try {
    const { articleId, regenerate } = await req.json();

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article with metadata
    const article = await db.query.articles.findFirst({
      where: eq(articles.id, articleId),
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Check if already has generated image
    if (article.generatedImageUrl && !regenerate) {
      return NextResponse.json({
        success: true,
        imageUrl: article.generatedImageUrl,
        skipped: true
      });
    }

    // Update status to generating
    await db
      .update(articles)
      .set({
        imageGenerationStatus: "generating",
        imageGenerationError: null
      })
      .where(eq(articles.id, articleId));

    try {
      // Parse categories from JSON
      const categories = article.categoriesJson
        ? JSON.parse(article.categoriesJson)
        : [];

      // Build prompt with article context (use more text for better relevance)
      const prompt = buildImagePrompt({
        title: article.title,
        categories,
        summary: article.originalText?.slice(0, 500) || article.title
      });

      console.log("[Image Generation] Generated prompt:", {
        articleId,
        promptLength: prompt.length,
        categories
      });

      // Generate image via Replicate
      const imageUrl = await generateImage({
        prompt,
        aspectRatio: "3:4",
        resolution: "2K",
        outputFormat: "jpg"
      });

      // Update article with generated image
      await db
        .update(articles)
        .set({
          generatedImageUrl: imageUrl,
          generatedImagePrompt: prompt,
          imageGenerationStatus: "completed",
          imageGeneratedAt: new Date(),
          imageGenerationError: null
        })
        .where(eq(articles.id, articleId));

      console.log("[Image Generation] Success:", {
        articleId,
        imageUrl
      });

      return NextResponse.json({
        success: true,
        imageUrl,
        prompt
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update status to failed
      await db
        .update(articles)
        .set({
          imageGenerationStatus: "failed",
          imageGenerationError: errorMessage
        })
        .where(eq(articles.id, articleId));

      console.error("[Image Generation] Failed:", {
        articleId,
        error: errorMessage
      });

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Image Generation API] Error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
