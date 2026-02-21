import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import { ArrowRight, Play, Sparkles, Volume2 } from "lucide-react";

interface FeaturedArticleHeroProps {
  article: Article & {
    audioFiles?: AudioFile[];
  };
}

export function FeaturedArticleHero({ article }: FeaturedArticleHeroProps) {
  const displayImage = hasPersistentGeneratedImage(article.generatedImageUrl)
    ? article.generatedImageUrl
    : article.imageUrl;
  const primaryAudioFile = article.audioFiles?.[0];
  const hasAudio = Boolean(primaryAudioFile);
  const summary = article.originalText
    ? `${article.originalText.slice(0, 220)}...`
    : "Turn this article into studio-grade narration and continue listening from any device.";

  return (
    <section className="netflix-hero">
      {displayImage ? (
        <div className="netflix-hero-media" style={{ backgroundImage: `url(${displayImage})` }} />
      ) : (
        <div className="netflix-hero-media netflix-hero-media-fallback" />
      )}

      <div className="netflix-hero-content">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/85">
          <Sparkles className="h-3.5 w-3.5 text-[#e50914]" />
          Featured Story
        </div>

        <h1 className="netflix-hero-title">{article.title}</h1>
        <p className="netflix-hero-description line-clamp-3">{summary}</p>

        <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
          <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1">
            {article.wordCount.toLocaleString()} words
          </span>
          {hasAudio && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e50914]/35 bg-[#e50914]/15 px-3 py-1 text-white/85">
              <Volume2 className="h-3.5 w-3.5" />
              Ready to play
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {hasAudio ? (
            <Link
              href={`/player/${primaryAudioFile!.id}`}
              className="netflix-button netflix-button-primary"
            >
              <Play className="h-4 w-4" fill="white" />
              Open Player
            </Link>
          ) : (
            <Link href={`/voice-select/${article.id}`} className="netflix-button netflix-button-primary">
              Start voice setup
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <Link href="/library" className="netflix-button netflix-button-secondary">
            Explore library
          </Link>
        </div>

        {hasAudio && (
          <Link
            href={`/player/${primaryAudioFile!.id}`}
            className="mt-3 inline-block text-xs text-white/50 transition-colors hover:text-white/85"
          >
            {`Player URL: /player/${primaryAudioFile!.id}`}
          </Link>
        )}
      </div>
    </section>
  );
}
