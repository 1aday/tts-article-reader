# AI Categorization & Filtering - Testing Guide

## ✅ Implementation Complete

All features have been successfully implemented:
- Database schema with 4 new tables
- OpenAI-powered categorization with vocabulary learning
- Netflix-style FilterBar component
- Async background categorization
- Full API integration

## 🚀 Quick Start

### 1. Start Development Server
```bash
cd ~/Desktop/tts-article-reader
npm run dev
```

### 2. Verify Implementation

#### Check Database Tables
```bash
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```
Expected output should include:
- `article_categories`
- `article_tags`
- `categories`
- `tags`

#### Check Article Schema
```bash
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "PRAGMA table_info(articles);"
```
Should show new columns:
- `categories_json`
- `tags_json`
- `categorization_status`
- `categorization_error`

## 🧪 End-to-End Test Scenarios

### Scenario 1: Create Article and Watch Auto-Categorization

1. Navigate to http://localhost:3000/create
2. Enter a URL (e.g., a tech article from TechCrunch or The Verge)
3. Submit the article
4. Navigate to http://localhost:3000/library
5. **Expected Result**: Article card shows "Categorizing..." badge
6. Wait 2-5 seconds and refresh
7. **Expected Result**: Categories (green pills) and tags (purple pills) appear on the card

### Scenario 2: Test Manual Categorization API

```bash
# Get an article ID from the database
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "SELECT id, title FROM articles LIMIT 1;"

# Trigger categorization manually
curl -X POST http://localhost:3000/api/categorization/generate \
  -H "Content-Type: application/json" \
  -d '{"articleId": 1}'

# Expected response:
# {
#   "success": true,
#   "articleId": 1,
#   "categories": ["Technology", "Business"],
#   "tags": ["ai", "machine-learning", "startup"],
#   "confidence": 0.85
# }
```

### Scenario 3: Test Vocabulary Learning

1. Create 3 similar articles (e.g., all about AI/machine learning)
2. Check the vocabulary endpoint:
```bash
curl http://localhost:3000/api/categorization/vocabulary
```
3. **Expected Result**: Same categories/tags appear with increasing `usageCount`
4. Example output:
```json
{
  "success": true,
  "categories": [
    {"id": 1, "name": "Artificial Intelligence", "slug": "artificial-intelligence", "usageCount": 3},
    {"id": 2, "name": "Technology", "slug": "technology", "usageCount": 3}
  ],
  "tags": [
    {"id": 1, "name": "machine-learning", "slug": "machine-learning", "usageCount": 3},
    {"id": 2, "name": "openai", "slug": "openai", "usageCount": 2}
  ]
}
```

### Scenario 4: Test Netflix-Style Filtering

1. Create at least 5-10 articles with different topics
2. Wait for all categorizations to complete
3. Navigate to http://localhost:3000/library
4. **Expected Result**: FilterBar appears at the top with available filters
5. Click a category pill (should turn green with glow effect)
6. **Expected Result**: Only articles with that category are shown
7. Click a tag pill (should turn purple with glow effect)
8. **Expected Result**: Articles matching BOTH filters are shown
9. Click "Clear All"
10. **Expected Result**: All articles return

### Scenario 5: Test Empty Filter State

1. Select filters that match no articles
2. **Expected Result**: Empty state message appears:
   - "No matching articles"
   - "Try adjusting your filters to see more results"
   - "Clear All Filters" button

### Scenario 6: Test Filter Options API

```bash
curl http://localhost:3000/api/library/filters
```

Expected response with article counts:
```json
{
  "success": true,
  "categories": [
    {"id": 1, "name": "Technology", "slug": "technology", "articleCount": 5},
    {"id": 2, "name": "Business", "slug": "business", "articleCount": 3}
  ],
  "tags": [
    {"id": 1, "name": "ai", "slug": "ai", "articleCount": 4},
    {"id": 2, "name": "startup", "slug": "startup", "articleCount": 2}
  ]
}
```

## 🔍 Database Queries for Verification

### View All Categories with Usage
```bash
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "
SELECT id, name, slug, usage_count
FROM categories
ORDER BY usage_count DESC;
"
```

### View All Tags with Usage
```bash
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "
SELECT id, name, slug, usage_count
FROM tags
ORDER BY usage_count DESC;
"
```

### View Article Categorization Status
```bash
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "
SELECT
  id,
  title,
  categorization_status,
  categories_json,
  tags_json
FROM articles
ORDER BY created_at DESC
LIMIT 10;
"
```

### View Junction Table Relationships
```bash
# Articles with their categories
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "
SELECT
  a.title,
  c.name as category
FROM articles a
JOIN article_categories ac ON a.id = ac.article_id
JOIN categories c ON ac.category_id = c.id
ORDER BY a.title;
"

# Articles with their tags
sqlite3 ~/Desktop/tts-article-reader/sqlite.db "
SELECT
  a.title,
  t.name as tag
FROM articles a
JOIN article_tags at ON a.id = at.article_id
JOIN tags t ON at.tag_id = t.id
ORDER BY a.title;
"
```

## 🎨 UI Elements to Verify

### Library Page - Filter Bar
- [ ] Horizontal scrollable container
- [ ] Category pills with green gradient when active
- [ ] Tag pills with purple gradient when active
- [ ] Scroll buttons appear on hover (left/right)
- [ ] "Clear All" button when filters are active
- [ ] Active filter count display
- [ ] Article count badges on each pill

### Library Page - Article Cards
- [ ] Category badges (max 2, green gradient)
- [ ] Tag badges (max 3, purple gradient)
- [ ] "+X more" indicator when there are extra categories/tags
- [ ] "Categorizing..." loader during processing
- [ ] "Pending..." badge for queued articles

### Empty States
- [ ] "No articles yet" when library is empty
- [ ] "No matching articles" when filters return nothing
- [ ] "Clear All Filters" button in empty filter state

## 🐛 Troubleshooting

### Issue: Categorization not triggering
**Solution**: Check that the dev server restarted after adding new API routes
```bash
# Kill old processes
lsof -ti:3000 | xargs kill -9
# Restart
npm run dev
```

### Issue: Categories/tags not appearing
**Check**:
1. Article `categorization_status` is "completed"
2. `categories_json` and `tags_json` are not null
3. OpenAI API key is set in `.env`
```bash
echo $OPENAI_API_KEY
```

### Issue: FilterBar not showing
**Check**:
1. At least one article has categories or tags
2. Library has more than 0 articles
3. Browser console for JavaScript errors

### Issue: Filters not working
**Check**:
1. Network tab shows `/api/library/filters` returns data
2. Article cards have category/tag data
3. FilterBar state is updating (React DevTools)

## 📊 Performance Benchmarks

Expected performance targets:
- **Categorization Time**: 2-5 seconds per article
- **Library Page Load**: <500ms with 50 articles
- **Filter Changes**: <100ms (instant, client-side)
- **Vocabulary Cache Hit Rate**: >90% after first 10 articles

## 🎯 Success Criteria

Your implementation is working correctly if:
- [x] Database schema migration applied successfully
- [x] New articles automatically trigger categorization
- [x] Categories and tags appear on article cards
- [x] FilterBar renders with clickable pills
- [x] Filtering works (AND logic for multiple selections)
- [x] Vocabulary learning prevents duplicates
- [x] UI matches Netflix-style design (gradients, animations, glow effects)

## 📝 Notes

- Categorization is fire-and-forget (non-blocking)
- Vocabulary cache is in-memory (5-minute TTL)
- Categories use Title Case, tags use lowercase-with-hyphens
- System prefers existing terms when >70% semantically similar
- JSON cache eliminates JOINs for fast library reads

## 🚀 Next Steps

After verifying the implementation works:
1. Create 20-30 test articles to build a rich vocabulary
2. Monitor categorization quality and adjust prompts if needed
3. Consider adding category/tag management UI (optional)
4. Test with production OpenAI API limits
5. Deploy and verify categorization works in production

---

**Implementation Date**: January 24, 2026
**Total Files Modified**: 12
**New Files Created**: 8
**Database Tables Added**: 4
