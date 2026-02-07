# TTS Article Reader

Converts articles into natural-sounding audio using AI text-to-speech with a retro terminal aesthetic.

## What it does

TTS Article Reader scrapes any article URL using Firecrawl, processes the content with OpenAI, and converts it into natural-sounding audio via ElevenLabs text-to-speech. Features a distinctive retro terminal-inspired UI that makes the reading and listening experience uniquely engaging. All articles and audio files are persisted locally using Drizzle ORM with SQLite for offline access.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **OpenAI** - Content processing and summarization
- **ElevenLabs** - High-quality text-to-speech
- **Firecrawl** - Web scraping and article extraction
- **Drizzle ORM** - TypeScript ORM for database access
- **SQLite** - Local persistent storage

## Getting Started

```bash
git clone https://github.com/1aday/tts-article-reader.git
cd tts-article-reader
npm install
npm run dev
```

## Environment Variables

Create a `.env.local` file with the following:

```
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

---
*Built by [@1aday](https://github.com/1aday)*
