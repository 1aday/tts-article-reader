#!/usr/bin/env node

/**
 * Migration: Add imageUrl column to articles table
 * Run with: node migrate-add-image-url.js
 */

const Database = require('better-sqlite3');
const db = new Database('./sqlite.db');

try {
  console.log('Running migration: Add imageUrl column...');

  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
  const hasImageUrl = tableInfo.some(col => col.name === 'image_url');

  if (hasImageUrl) {
    console.log('✓ Column image_url already exists, skipping migration');
  } else {
    // Add the column
    db.prepare('ALTER TABLE articles ADD COLUMN image_url TEXT').run();
    console.log('✓ Added image_url column to articles table');
  }

  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
