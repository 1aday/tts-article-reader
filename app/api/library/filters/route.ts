import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { categories, tags, articleCategories, articleTags } from "@/lib/db/schema";
import { sql, desc } from "drizzle-orm";

/**
 * GET /api/library/filters
 * Get all categories and tags with article counts for filtering
 */
export async function GET() {
  try {
    // Get categories with article counts
    const categoriesWithCounts = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        articleCount: sql<number>`count(${articleCategories.articleId})`,
      })
      .from(categories)
      .leftJoin(articleCategories, sql`${categories.id} = ${articleCategories.categoryId}`)
      .groupBy(categories.id)
      .orderBy(desc(sql`count(${articleCategories.articleId})`));

    // Get tags with article counts
    const tagsWithCounts = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        articleCount: sql<number>`count(${articleTags.articleId})`,
      })
      .from(tags)
      .leftJoin(articleTags, sql`${tags.id} = ${articleTags.tagId}`)
      .groupBy(tags.id)
      .orderBy(desc(sql`count(${articleTags.articleId})`));

    // Filter out categories/tags with 0 articles
    const activeCategories = categoriesWithCounts.filter(c => c.articleCount > 0);
    const activeTags = tagsWithCounts.filter(t => t.articleCount > 0);

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
