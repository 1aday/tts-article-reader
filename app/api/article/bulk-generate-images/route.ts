import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { eq, or, isNull, inArray } from "drizzle-orm";

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
          results.skipped++;
          continue;
        }

        // Call single generation endpoint
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/article/generate-image`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              articleId: article.id,
              regenerate
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.skipped) {
            results.skipped++;
          } else {
            results.generated++;
          }
        } else {
          const errorData = await response.json();
          results.failed++;
          results.errors.push({
            articleId: article.id,
            error: errorData.error || "Unknown error"
          });
        }

        // Rate limit: 2-second delay between generations
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        results.failed++;
        results.errors.push({
          articleId: article.id,
          error: error instanceof Error ? error.message : String(error)
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
