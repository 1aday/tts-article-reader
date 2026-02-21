import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";

/**
 * GET /api/library/filters
 * Get all categories and tags with article counts for filtering
 * Extracts from cached JSON fields for performance
 */
export async function GET() {
  try {
    // Fetch only cached categorization fields used by this endpoint.
    const allArticles = await db
      .select({
        id: articles.id,
        categoriesJson: articles.categoriesJson,
        tagsJson: articles.tagsJson,
      })
      .from(articles);

    // Count categories and tags from JSON cache
    const categoryCount = new Map<string, number>();
    const tagCount = new Map<string, number>();

    for (const article of allArticles) {
      // Parse categories
      if (article.categoriesJson) {
        try {
          const cats = JSON.parse(article.categoriesJson) as string[];
          cats.forEach(cat => {
            categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
          });
        } catch (e) {
          console.error('Failed to parse categories for article', article.id, e);
        }
      }

      // Parse tags
      if (article.tagsJson) {
        try {
          const articleTags = JSON.parse(article.tagsJson) as string[];
          articleTags.forEach(tag => {
            tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
          });
        } catch (e) {
          console.error('Failed to parse tags for article', article.id, e);
        }
      }
    }

    // Convert to array and sort by count (descending)
    const activeCategories = Array.from(categoryCount.entries())
      .map(([name, count], index) => ({
        id: index + 1,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        articleCount: count
      }))
      .sort((a, b) => b.articleCount - a.articleCount);

    const activeTags = Array.from(tagCount.entries())
      .map(([name, count], index) => ({
        id: index + 1,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        articleCount: count
      }))
      .sort((a, b) => b.articleCount - a.articleCount);

    return NextResponse.json({
      success: true,
      categories: activeCategories,
      tags: activeTags,
      totalCategories: activeCategories.length,
      totalTags: activeTags.length,
    });
  } catch (error) {
    console.error("Filters API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch filters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
