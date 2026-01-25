import { NextRequest, NextResponse } from "next/server";
import { categorizeArticle } from "@/lib/api/categorization";

/**
 * POST /api/categorization/generate
 * Trigger async categorization for an article
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    // Run categorization
    const result = await categorizeArticle(articleId);

    return NextResponse.json({
      success: true,
      articleId,
      categories: result.categories,
      tags: result.tags,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Categorization API error:", error);
    return NextResponse.json(
      {
        error: "Failed to categorize article",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
