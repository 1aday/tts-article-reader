import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scrapeArticle, extractFeaturedImage } from "@/lib/api/firecrawl";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const refreshImageSchema = z.object({
  articleId: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = refreshImageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { articleId } = validation.data;

    // Get the article
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Check if article has a source URL
    if (!article.sourceUrl) {
      return NextResponse.json(
        { error: "Article has no source URL to fetch image from" },
        { status: 400 }
      );
    }

    // Re-scrape to get metadata
    console.log(`[RefreshImage] Re-scraping ${article.sourceUrl} for article ${articleId}`);
    const result = await scrapeArticle(article.sourceUrl);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Failed to scrape article" },
        { status: 500 }
      );
    }

    // Extract featured image from metadata
    const imageUrl = extractFeaturedImage(result.data.metadata || {});

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image found in article metadata" },
        { status: 404 }
      );
    }

    // Update the article with the new image
    await db
      .update(articles)
      .set({
        imageUrl,
        metadata: JSON.stringify(result.data.metadata),
        updatedAt: new Date()
      })
      .where(eq(articles.id, articleId));

    console.log(`[RefreshImage] Updated article ${articleId} with image: ${imageUrl}`);

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error("Refresh image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
