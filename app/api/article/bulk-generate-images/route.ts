import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { eq, or, isNull, inArray, like } from "drizzle-orm";
import { generateImage } from "@/lib/api/replicate";
import { buildImagePrompt } from "@/lib/utils/image-generation";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";

export const maxDuration = 300; // 5 minutes

const MAX_GENERATION_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 4000;
const RETRYABLE_GENERATION_ERROR =
  /(429|503|504|busy|overload|overloaded|temporar|timeout|rate limit|too many requests|try again)/i;

function shouldRetryGenerationError(message: string): boolean {
  return RETRYABLE_GENERATION_ERROR.test(message);
}

async function generateImageWithRetry(
  articleId: number,
  prompt: string
): Promise<string> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      return await generateImage({
        prompt,
        aspectRatio: "3:4",
        resolution: "2K",
        outputFormat: "jpg"
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = errorMessage;
      const canRetry =
        attempt < MAX_GENERATION_ATTEMPTS && shouldRetryGenerationError(errorMessage);

      if (!canRetry) {
        throw new Error(errorMessage);
      }

      const delayMs = RETRY_BASE_DELAY_MS * attempt;
      console.warn(`[Bulk] Retry ${attempt}/${MAX_GENERATION_ATTEMPTS - 1} for article ${articleId} after busy error:`, errorMessage);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(lastError || "Image generation failed after retries");
}

export async function POST(req: NextRequest) {
  try {
    const { articleIds, regenerate } = await req.json();

    let filterCondition: ReturnType<typeof inArray> | ReturnType<typeof or> | undefined;

    if (articleIds && Array.isArray(articleIds) && articleIds.length > 0) {
      // Generate for specific articles
      filterCondition = inArray(articles.id, articleIds);
    } else if (!regenerate) {
      // Only generate for pending articles (no generated image yet)
      filterCondition = or(
        eq(articles.imageGenerationStatus, "pending"),
        isNull(articles.imageGenerationStatus),
        eq(articles.imageGenerationStatus, "failed"),
        isNull(articles.generatedImageUrl),
        like(articles.generatedImageUrl, "%replicate.delivery%")
      );
    }

    const articlesToProcess = filterCondition
      ? await db.select().from(articles).where(filterCondition)
      : await db.select().from(articles);

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
        const hasPersistentImage = hasPersistentGeneratedImage(article.generatedImageUrl);

        // Skip if already has image and not regenerating
        if (hasPersistentImage && !regenerate) {
          console.log(`[Bulk] Skipping article ${article.id} - already has image`);
          results.skipped++;
          continue;
        }

        if (article.generatedImageUrl && !hasPersistentImage) {
          console.log(`[Bulk] Replacing temporary generated image URL for article ${article.id}`);
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

          // Build prompt (use more text for better relevance)
          const prompt = buildImagePrompt({
            title: article.title,
            categories,
            summary: article.originalText?.slice(0, 500) || article.title
          });

          // Generate image with retry for transient busy/rate-limit errors
          const imageUrl = await generateImageWithRetry(article.id, prompt);

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
