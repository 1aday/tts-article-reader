# TTS Article Reader

Transform any article into natural-sounding audio with AI-powered text-to-speech.

## Features

- ✨ **Retro Terminal Aesthetic** - Phosphor green CRT-style interface
- 📰 **Article Scraping** - Extract clean text from any URL using Firecrawl
- 🤖 **AI Enhancement** - OpenAI optimizes text for natural speech
- 🎙️ **Premium Voices** - Choose from 25+ ElevenLabs voices
- 🎧 **Audio Playback** - Full-featured player with progress tracking
- ⚡ **Real-time Progress** - SSE streaming for generation status

## Getting Started

### Installation

```bash
npm install
```

### Database Setup

```bash
npx drizzle-kit push
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 15 + TypeScript
- shadcn/ui + Tailwind CSS
- Drizzle ORM + SQLite
- OpenAI, ElevenLabs, Firecrawl APIs

## User Flow

1. Landing → Terminal interface
2. Create → Paste URL or text
3. Voice Select → Choose voice with preview
4. Generate → Real-time SSE progress
5. Player → Play generated audio
6. Library → Browse history

## API Keys

The `.env.local` file contains:
- OPENAI_API_KEY
- ELEVENLABS_API_KEY
- FIRECRAWL_API_KEY

## Rate Limits

- Scraping: 10/hour per IP
- Generation: 5/hour per IP
- Preview: 20/hour per IP

## Powered By

- [Firecrawl](https://firecrawl.dev)
- [OpenAI](https://openai.com)
- [ElevenLabs](https://elevenlabs.io)
