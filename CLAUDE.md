# TTS Article Reader

## Project Overview

TTS Article Reader is a Next.js 16 application that converts web articles into natural-sounding audio using AI text-to-speech technology. The application features a retro terminal aesthetic with a modern dark theme and integrates three external APIs: Firecrawl (article scraping), OpenAI (text enhancement), and ElevenLabs (premium TTS generation).

**Key Features**:
- URL and paste-based article input
- 25+ premium AI voices with customizable settings
- Real-time audio generation with SSE progress tracking
- Netflix-style library with featured images
- Full-featured audio player with visualizer
- Chrome extension for one-click article extraction

**Tech Stack**: Next.js 16, React 19, TypeScript, SQLite with Drizzle ORM, Tailwind CSS 4, Radix UI, shadcn/ui

## Architecture

The application follows a three-layer architecture:

1. **Client Layer**: Next.js pages with real-time updates via SSE
2. **API Layer**: RESTful routes + Server-Sent Events for streaming
3. **Data Layer**: SQLite database + Vercel Blob storage

**Primary User Flow**: Home → Create (URL/Paste) → Voice Select → Generate (SSE) → Player/Library

For detailed architecture, module guides, data flow diagrams, and navigation help, see **[docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md)**.

## Quick Reference

### Key Directories
- `app/` - Pages and API routes (Next.js App Router)
- `lib/` - Shared libraries (DB, API clients, utilities)
- `components/` - React components (UI library + custom)
- `chrome-extension/` - Browser extension for article extraction

### Important Files
- `lib/db/schema.ts` - Database schema (4 tables)
- `app/api/generate/route.ts` - Audio generation with chunking (2,898 tokens)
- `app/globals.css` - Design system (colors, animations, utilities)
- `lib/api/` - External API integrations (ElevenLabs, Firecrawl, OpenAI)

### Database Tables
- **articles** - Original and enhanced text with metadata
- **audioFiles** - Generated MP3 files with status tracking
- **voices** - Cached ElevenLabs voices (1-hour TTL)
- **processingJobs** - Background job tracking for long-running generations

### External APIs
- **ElevenLabs** (`eleven_turbo_v2_5`) - Text-to-speech generation
- **Firecrawl** (v2 API) - Article scraping with 2-day cache
- **OpenAI** (`gpt-4o-mini`) - Text enhancement for natural TTS

## Development

### Environment Variables
```bash
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
FIRECRAWL_API_KEY=...
```

### Setup
```bash
npm install
npx drizzle-kit push  # Initialize database
npm run dev           # Start dev server
```

### Chrome Extension
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension/` directory

## Recent Context

### Recent Enhancements (Jan 24, 2026)
- Button contrast fixes across all pages (accessibility)
- Inline audio player in library page (mini-player at bottom)
- Featured image extraction from article metadata
- Netflix-style card layout for library
- Chrome extension with context menu integration
- Enhanced TTS model upgrade to `eleven_turbo_v2_5`
- Voice settings parameter support in generation API
- Database migration adding `imageUrl` column to articles

## Production Notes

**Pre-deployment checklist**:
- Replace in-memory rate limiting with Vercel KV
- Update blob storage to use Vercel Blob exclusively
- Consider migrating SQLite to PostgreSQL
- Add error monitoring (Sentry, etc.)
- Configure CDN for audio delivery

See [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) for complete production deployment checklist.
