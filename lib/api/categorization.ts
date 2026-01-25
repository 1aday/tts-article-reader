import OpenAI from "openai";
import { db } from "../db/client";
import {
  articles,
  categories,
  tags,
  articleCategories,
  articleTags,
  type Category,
  type Tag
} from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory vocabulary cache with 5-minute TTL
interface VocabularyCache {
  data: {
    categories: Array<{ id: number; name: string; slug: string; usageCount: number }>;
    tags: Array<{ id: number; name: string; slug: string; usageCount: number }>;
  } | null;
  timestamp: number;
}

const vocabularyCache: VocabularyCache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get existing categories and tags from the database with in-memory caching
 */
export async function getVocabulary() {
  const now = Date.now();

  // Return cached data if still valid
  if (vocabularyCache.data && now - vocabularyCache.timestamp < CACHE_TTL) {
    return vocabularyCache.data;
  }

  // Fetch from database
  const [categoryList, tagList] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        usageCount: categories.usageCount,
      })
      .from(categories)
      .orderBy(desc(categories.usageCount)),
    db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        usageCount: tags.usageCount,
      })
      .from(tags)
      .orderBy(desc(tags.usageCount)),
  ]);

  // Update cache
  vocabularyCache.data = {
    categories: categoryList,
    tags: tagList,
  };
  vocabularyCache.timestamp = now;

  return vocabularyCache.data;
}

/**
 * Invalidate the vocabulary cache after new categorizations
 */
export function invalidateVocabularyCache() {
  vocabularyCache.data = null;
  vocabularyCache.timestamp = 0;
}

/**
 * Generate a slug from a name (lowercase, hyphenated)
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Upsert a category (create if new, increment usage if exists)
 */
async function upsertCategory(name: string): Promise<number> {
  const slug = generateSlug(name);

  // Check if exists
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    // Increment usage count
    await db
      .update(categories)
      .set({
        usageCount: sql`${categories.usageCount} + 1`,
        name: name // Update name in case of casing changes
      })
      .where(eq(categories.id, existing[0].id));
    return existing[0].id;
  }

  // Create new category
  const [newCategory] = await db
    .insert(categories)
    .values({
      name,
      slug,
      usageCount: 1,
    })
    .returning();

  return newCategory.id;
}

/**
 * Upsert a tag (create if new, increment usage if exists)
 */
async function upsertTag(name: string): Promise<number> {
  const slug = generateSlug(name);

  // Check if exists
  const existing = await db
    .select()
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    // Increment usage count
    await db
      .update(tags)
      .set({
        usageCount: sql`${tags.usageCount} + 1`,
        name: name // Update name in case of casing changes
      })
      .where(eq(tags.id, existing[0].id));
    return existing[0].id;
  }

  // Create new tag
  const [newTag] = await db
    .insert(tags)
    .values({
      name,
      slug,
      usageCount: 1,
    })
    .returning();

  return newTag.id;
}

/**
 * Main categorization function using OpenAI
 */
export async function categorizeArticle(articleId: number) {
  try {
    // Update status to processing
    await db
      .update(articles)
      .set({
        categorizationStatus: "processing",
        categorizationError: null,
      })
      .where(eq(articles.id, articleId));

    // Get article content
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!article) {
      throw new Error("Article not found");
    }

    // Get existing vocabulary for prompt context
    const vocab = await getVocabulary();

    // Build dynamic system prompt
    const systemPrompt = `You are a content categorization expert. Analyze the article and assign:
- 2-4 CATEGORIES (broad topics like Technology, Business, Health, Science)
- 3-8 TAGS (specific keywords, concepts, tools, technologies)

${vocab.categories.length > 0 ? `
EXISTING CATEGORIES (prefer these when article matches):
${vocab.categories.slice(0, 20).map(c => `- ${c.name} (used ${c.usageCount}x)`).join('\n')}
` : 'No existing categories yet - create appropriate ones.'}

${vocab.tags.length > 0 ? `
EXISTING TAGS (prefer these when article matches):
${vocab.tags.slice(0, 30).map(t => `- ${t.name} (used ${t.usageCount}x)`).join('\n')}
` : 'No existing tags yet - create appropriate ones.'}

RULES:
1. Reuse existing categories/tags when the article semantically matches (>70% similarity)
2. Only create new ones if the content is genuinely different or more specific
3. Use Title Case for categories (e.g., "Artificial Intelligence", "Web Development")
4. Use lowercase with hyphens for tags (e.g., "machine-learning", "react", "typescript")
5. Categories should be broad topics, tags should be specific concepts/tools
6. Avoid generic categories like "General" or "Miscellaneous"

Return ONLY valid JSON with this exact structure:
{
  "categories": ["Category 1", "Category 2"],
  "tags": ["tag-1", "tag-2", "tag-3"],
  "confidence": 0.95
}`;

    // Prepare article content for analysis (use enhanced text if available)
    const contentToAnalyze = article.enhancedText || article.originalText;
    const truncatedContent = contentToAnalyze.slice(0, 4000); // Limit to ~1000 tokens

    // Call OpenAI with JSON mode
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Article Title: ${article.title}\n\nContent:\n${truncatedContent}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    if (!result.categories || !result.tags) {
      throw new Error("Invalid response from OpenAI - missing categories or tags");
    }

    // Validate and sanitize results
    const categoryNames: string[] = result.categories.slice(0, 4);
    const tagNames: string[] = result.tags.slice(0, 8);
    const confidence: number = result.confidence || 0.8;

    if (categoryNames.length === 0) {
      throw new Error("No categories returned from OpenAI");
    }

    // Upsert categories and create junction entries
    const categoryIds = await Promise.all(
      categoryNames.map(name => upsertCategory(name))
    );

    // Upsert tags and create junction entries
    const tagIds = await Promise.all(
      tagNames.map(name => upsertTag(name))
    );

    // Delete existing junction entries (for re-categorization)
    await db
      .delete(articleCategories)
      .where(eq(articleCategories.articleId, articleId));

    await db
      .delete(articleTags)
      .where(eq(articleTags.articleId, articleId));

    // Create new junction entries
    if (categoryIds.length > 0) {
      await db.insert(articleCategories).values(
        categoryIds.map(categoryId => ({
          articleId,
          categoryId,
        }))
      );
    }

    if (tagIds.length > 0) {
      await db.insert(articleTags).values(
        tagIds.map(tagId => ({
          articleId,
          tagId,
        }))
      );
    }

    // Update article with JSON cache and status
    await db
      .update(articles)
      .set({
        categoriesJson: JSON.stringify(categoryNames),
        tagsJson: JSON.stringify(tagNames),
        categorizationStatus: "completed",
        categorizationError: null,
      })
      .where(eq(articles.id, articleId));

    // Invalidate cache so next categorization gets updated vocabulary
    invalidateVocabularyCache();

    return {
      categories: categoryNames,
      tags: tagNames,
      confidence,
    };
  } catch (error) {
    console.error("Categorization error:", error);

    // Update article with error status
    await db
      .update(articles)
      .set({
        categorizationStatus: "failed",
        categorizationError: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(articles.id, articleId));

    throw error;
  }
}
