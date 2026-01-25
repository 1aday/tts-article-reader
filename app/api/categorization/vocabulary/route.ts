import { NextResponse } from "next/server";
import { getVocabulary } from "@/lib/api/categorization";

/**
 * GET /api/categorization/vocabulary
 * Get all categories and tags with usage counts (cached)
 */
export async function GET() {
  try {
    const vocabulary = await getVocabulary();

    return NextResponse.json({
      success: true,
      categories: vocabulary.categories,
      tags: vocabulary.tags,
      totalCategories: vocabulary.categories.length,
      totalTags: vocabulary.tags.length,
    });
  } catch (error) {
    console.error("Vocabulary API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch vocabulary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
