import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scrapeArticle, extractWordCount, extractFeaturedImage } from "@/lib/api/firecrawl";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { rateLimits, getClientIp, formatRateLimitError } from "@/lib/rate-limit";

const scrapeSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await rateLimits.scrape.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: formatRateLimitError(reset) },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = scrapeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { url } = validation.data;

    // Scrape article
    const result = await scrapeArticle(url);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Failed to scrape article" },
        { status: 500 }
      );
    }

    // Extract data
    const { markdown, metadata } = result.data;
    const title = metadata?.title || "Untitled Article";
    const wordCount = extractWordCount(markdown);
    const imageUrl = extractFeaturedImage(metadata || {});

    // Save to database
    const [article] = await db
      .insert(articles)
      .values({
        title,
        originalText: markdown,
        sourceUrl: url,
        sourceType: "url",
        wordCount,
        imageUrl,
        metadata: JSON.stringify(metadata),
        categorizationStatus: "pending",
      })
      .returning();

    // Trigger categorization (fire-and-forget)
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/categorization/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: article.id }),
    }).catch((err) => console.error("Failed to trigger categorization:", err));

    return NextResponse.json(
      {
        success: true,
        article: {
          id: article.id,
          title: article.title,
          wordCount: article.wordCount,
          createdAt: article.createdAt,
        },
      },
      {
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
