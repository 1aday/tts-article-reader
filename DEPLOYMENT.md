# Vercel Deployment Guide

This guide will walk you through deploying the TTS Article Reader to Vercel with Postgres database.

## Prerequisites

- Vercel account ([sign up here](https://vercel.com/signup))
- Vercel CLI installed (you already have it!)
- API keys ready:
  - OpenAI API key
  - ElevenLabs API key
  - Firecrawl API key

## Step 1: Link Project to Vercel

```bash
cd /Users/am/Desktop/tts-article-reader
vercel link --yes
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account/team
- **Link to existing project?** No (unless you already created one)
- **Project name?** tts-article-reader (or your preferred name)

This creates a `.vercel` directory with project configuration.

## Step 2: Create Postgres Database

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Click "Storage" tab
4. Click "Create Database"
5. Select "Postgres" (powered by Neon)
6. Name: `tts-article-reader-db`
7. Region: Choose closest to your users (e.g., us-east-1)
8. Click "Create"

Vercel will automatically add these environment variables:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### Option B: Via CLI

```bash
# This opens the Vercel dashboard in your browser
vercel storage create --postgres
```

## Step 3: Add API Keys to Vercel

Add your API keys to Vercel environment variables:

```bash
# OpenAI
vercel env add OPENAI_API_KEY

# ElevenLabs
vercel env add ELEVENLABS_API_KEY

# Firecrawl
vercel env add FIRECRAWL_API_KEY
```

Or add them via the dashboard:
1. Project → Settings → Environment Variables
2. Add each key for Production, Preview, and Development environments

## Step 4: Pull Environment Variables Locally

```bash
vercel env pull .env.local
```

This downloads all environment variables (including the database credentials) to your local `.env.local` file.

## Step 5: Push Database Schema

```bash
npx drizzle-kit push
```

This creates all the tables in your Vercel Postgres database:
- `articles` - Article content and metadata
- `audioFiles` - Generated MP3 files
- `voices` - Cached ElevenLabs voices
- `processingJobs` - Background job tracking

## Step 6: Deploy to Production

```bash
vercel --prod
```

This will:
1. Build your Next.js application
2. Deploy to Vercel's global CDN
3. Connect to your Postgres database
4. Make your app available at `your-project.vercel.app`

## Step 7: Verify Deployment

1. Visit your deployment URL
2. Test the following:
   - Create article (URL or paste)
   - Select voice
   - Generate audio
   - Play audio in library
   - Chrome extension (if installed)

## Post-Deployment Checklist

### Update Chrome Extension

If you're using the Chrome extension, update the API endpoint:

1. Edit `chrome-extension/popup.js`
2. Change the API URL:
   ```javascript
   const API_BASE = 'https://your-project.vercel.app';
   ```
3. Reload the extension in Chrome

### Add Custom Domain (Optional)

1. Project → Settings → Domains
2. Add your domain
3. Configure DNS records as shown

### Monitor Database Usage

- Go to Storage → your database → Usage
- Check storage, queries, and connection limits
- Neon free tier: 512 MB storage, 1 GB data transfer/month

### Enable Vercel Blob Storage

Your app already uses `@vercel/blob` for audio file storage. Vercel Blob is automatically provisioned when you deploy.

### Set Up Monitoring (Optional)

1. Enable Vercel Analytics:
   - Project → Analytics → Enable
2. Add error tracking (e.g., Sentry):
   - Install: `npm install @sentry/nextjs`
   - Follow [Sentry Next.js setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

## Database Migration Notes

### Changes Made

1. **Database Client** (`lib/db/client.ts`):
   - Migrated from `better-sqlite3` to `@vercel/postgres`
   - Using Drizzle ORM with Vercel Postgres adapter

2. **Drizzle Config** (`drizzle.config.ts`):
   - Changed dialect from `sqlite` to `postgresql`
   - Using `POSTGRES_URL` environment variable

3. **Dependencies**:
   - Added: `@vercel/postgres`, `drizzle-orm`
   - Can remove: `better-sqlite3` (optional - keep for local dev rollback)

### Schema Compatibility

The existing schema is fully compatible with Postgres. No changes needed:
- SQLite `INTEGER` → Postgres `INTEGER`
- SQLite `TEXT` → Postgres `TEXT`
- SQLite `DATETIME` → Postgres `TIMESTAMP`

## Troubleshooting

### Database Connection Issues

**Error:** "Invalid connection string"
**Fix:** Check that `POSTGRES_URL` is set correctly:
```bash
vercel env pull .env.local
cat .env.local | grep POSTGRES_URL
```

### Build Failures

**Error:** Type errors during build
**Fix:** Run a local build first:
```bash
npm run build
```

### API Rate Limits

**Error:** 429 Too Many Requests
**Fix:** The app uses in-memory rate limiting. For production, consider:
- Upgrading to Vercel KV for distributed rate limiting
- Implementing user authentication
- Adding request throttling

### Blob Storage Errors

**Error:** "Blob upload failed"
**Fix:** Ensure `BLOB_READ_WRITE_TOKEN` is set. Vercel adds this automatically on first deployment.

## Rollback Plan

If you need to rollback to SQLite:

1. **Revert database client:**
   ```bash
   git checkout lib/db/client.ts drizzle.config.ts
   ```

2. **Reinstall SQLite:**
   ```bash
   npm install better-sqlite3 @types/better-sqlite3
   ```

3. **Restore local database:**
   ```bash
   cp sqlite.db.backup sqlite.db  # if you made a backup
   ```

## Local Development vs Production

- **Local:** Uses Postgres via `POSTGRES_URL` from `.env.local`
- **Production:** Uses Vercel Postgres (same code, different connection)
- **Consistency:** Schema is identical in both environments

## Next Steps

1. Set up a custom domain
2. Enable Vercel Analytics
3. Add error monitoring
4. Consider migrating rate limiting to Vercel KV
5. Set up CI/CD with GitHub integration
6. Add end-to-end tests

## Resources

- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
