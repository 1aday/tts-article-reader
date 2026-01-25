import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { eq, or, isNull, inArray } from "drizzle-orm";
import { generateImage } from "@/lib/api/replicate";
import { buildImagePrompt } from "@/lib/utils/image-generation";

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const { articleIds, regenerate } = await req.json();

    let query = db.select().from(articles);

    if (articleIds && Array.isArray(articleIds) && articleIds.length > 0) {
      // Generate for specific articles
      query = query.where(inArray(articles.id, articleIds)) as any;
    } else if (!regenerate) {
      // Only generate for pending articles (no generated image yet)
      query = query.where(
        or(
          eq(articles.imageGenerationStatus, "pending"),
          isNull(articles.imageGenerationStatus),
          eq(articles.imageGenerationStatus, "failed")
        )
      ) as any;
    }

    const articlesToProcess = await query;

    console.log("[Bulk Image Generation] Starting:", {
      totalArticles: articlesToProcess.length,
      regenerate,
      specificIds: articleIds
    });

    const results = {
      total: articlesToProcess.length,
      generated: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ articleId: number; error: string }>
    };

    for (const article of articlesToProcess) {
      try {
        // Skip if already has image and not regenerating
        if (article.generatedImageUrl && !regenerate) {
          console.log(`[Bulk] Skipping article ${article.id} - already has image`);
          results.skipped++;
          continue;
        }

        console.log(`[Bulk] Generating image for article ${article.id}: ${article.title}`);

        // Update status to generating
        await db
          .update(articles)
          .set({
            imageGenerationStatus: "generating",
            imageGenerationError: null
          })
          .where(eq(articles.id, article.id));

        try {
          // Parse categories
          const categories = article.categoriesJson
            ? JSON.parse(article.categoriesJson)
            : [];

          // Build prompt
          const prompt = buildImagePrompt({
            title: article.title,
            categories,
            summary: article.originalText?.slice(0, 300) || article.title
          });

          // Generate image
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
            .where(eq(articles.id, article.id));

          console.log(`[Bulk] Success for article ${article.id}:`, imageUrl);
          results.generated++;

        } catch (genError) {
          const errorMessage = genError instanceof Error ? genError.message : String(genError);

          // Update status to failed
          await db
            .update(articles)
            .set({
              imageGenerationStatus: "failed",
              imageGenerationError: errorMessage
            })
            .where(eq(articles.id, article.id));

          console.error(`[Bulk] Failed for article ${article.id}:`, errorMessage);
          results.failed++;
          results.errors.push({
            articleId: article.id,
            error: errorMessage
          });
        }

        // Rate limit: 2-second delay between generations
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Bulk] Unexpected error for article ${article.id}:`, errorMessage);
        results.failed++;
        results.errors.push({
          articleId: article.id,
          error: errorMessage
        });
      }
    }

    console.log("[Bulk Image Generation] Complete:", results);

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Bulk Image Generation] Error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
