import { NextRequest, NextResponse } from "next/server";
import { scrapeArticle, extractFeaturedImage } from "@/lib/api/firecrawl";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { isNotNull, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    console.log("[BulkRefreshImages] Starting bulk image refresh");

    // Get all articles that have a source URL (whether they have an image or not)
    const articlesWithUrls = await db
      .select()
      .from(articles)
      .where(isNotNull(articles.sourceUrl));

    console.log(`[BulkRefreshImages] Found ${articlesWithUrls.length} articles with source URLs`);

    const results = {
      total: articlesWithUrls.length,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each article
    for (const article of articlesWithUrls) {
      try {
        if (!article.sourceUrl) {
          results.skipped++;
          continue;
        }

        console.log(`[BulkRefreshImages] Processing article ${article.id}: ${article.title}`);

        // Re-scrape to get metadata
        const result = await scrapeArticle(article.sourceUrl);

        if (!result.success || !result.data) {
          console.error(`[BulkRefreshImages] Failed to scrape article ${article.id}:`, result.error);
          results.failed++;
          results.errors.push(`Article ${article.id}: ${result.error || "Failed to scrape"}`);
          continue;
        }

        // Extract featured image
        const imageUrl = extractFeaturedImage(result.data.metadata || {});

        if (!imageUrl) {
          console.log(`[BulkRefreshImages] No image found for article ${article.id}`);
          results.failed++;
          results.errors.push(`Article ${article.id}: No image found in metadata`);
          continue;
        }

        // Update the article
        await db
          .update(articles)
          .set({
            imageUrl,
            metadata: JSON.stringify(result.data.metadata),
            updatedAt: new Date()
          })
          .where(eq(articles.id, article.id));

        console.log(`[BulkRefreshImages] Updated article ${article.id} with image: ${imageUrl}`);
        results.updated++;

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[BulkRefreshImages] Error processing article ${article.id}:`, error);
        results.failed++;
        results.errors.push(`Article ${article.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    console.log(`[BulkRefreshImages] Complete. Updated: ${results.updated}, Failed: ${results.failed}, Skipped: ${results.skipped}`);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[BulkRefreshImages] Bulk refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
