import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  originalText: text("original_text").notNull(),
  enhancedText: text("enhanced_text"),
  sourceUrl: text("source_url"),
  sourceType: text("source_type").notNull(), // 'url' or 'paste'
  wordCount: integer("word_count").notNull(),
  imageUrl: text("image_url"), // Featured image (OG/meta)
  metadata: text("metadata"), // JSON string
  categoriesJson: text("categories_json"), // Cached JSON array of category names
  tagsJson: text("tags_json"), // Cached JSON array of tag names
  categorizationStatus: text("categorization_status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  categorizationError: text("categorization_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  createdAtIdx: index("articles_created_at_idx").on(table.createdAt),
}));

export const audioFiles = sqliteTable("audio_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  voiceId: text("voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  blobUrl: text("blob_url"),
  duration: real("duration"), // in seconds
  fileSize: integer("file_size"), // in bytes
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  articleIdIdx: index("audio_files_article_id_idx").on(table.articleId),
  statusIdx: index("audio_files_status_idx").on(table.status),
}));

export const voices = sqliteTable("voices", {
  id: text("id").primaryKey(), // ElevenLabs voice ID
  name: text("name").notNull(),
  category: text("category"),
  previewUrl: text("preview_url"),
  labels: text("labels"), // JSON string array
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  lastFetched: integer("last_fetched", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const processingJobs = sqliteTable("processing_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  voiceId: text("voice_id").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'enhancing', 'generating', 'uploading', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  currentStep: text("current_step"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  statusIdx: index("processing_jobs_status_idx").on(table.status),
}));

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  usageCountIdx: index("categories_usage_count_idx").on(table.usageCount),
  nameIdx: index("categories_name_idx").on(table.name),
}));

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  usageCountIdx: index("tags_usage_count_idx").on(table.usageCount),
  nameIdx: index("tags_name_idx").on(table.name),
}));

export const articleCategories = sqliteTable("article_categories", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  pk: index("article_categories_pk").on(table.articleId, table.categoryId),
  articleIdx: index("article_categories_article_idx").on(table.articleId),
  categoryIdx: index("article_categories_category_idx").on(table.categoryId),
}));

export const articleTags = sqliteTable("article_tags", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  pk: index("article_tags_pk").on(table.articleId, table.tagId),
  articleIdx: index("article_tags_article_idx").on(table.articleId),
  tagIdx: index("article_tags_tag_idx").on(table.tagId),
}));

// Type exports
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type AudioFile = typeof audioFiles.$inferSelect;
export type NewAudioFile = typeof audioFiles.$inferInsert;
export type Voice = typeof voices.$inferSelect;
export type NewVoice = typeof voices.$inferInsert;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type NewProcessingJob = typeof processingJobs.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ArticleCategory = typeof articleCategories.$inferSelect;
export type NewArticleCategory = typeof articleCategories.$inferInsert;
export type ArticleTag = typeof articleTags.$inferSelect;
export type NewArticleTag = typeof articleTags.$inferInsert;
