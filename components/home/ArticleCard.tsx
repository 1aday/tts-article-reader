"use client";

import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import { usePlayer } from "@/contexts/PlayerContext";
import { Clock3, Loader2, Play, Trash2, Waves } from "lucide-react";

type ArticleWithAudio = Article & {
  audioFiles?: AudioFile[];
};

interface ArticleCardProps {
  article: ArticleWithAudio;
  onDeleteArticle?: (article: ArticleWithAudio) => void;
  deleting?: boolean;
}

export function ArticleCard({
  article,
  onDeleteArticle,
  deleting = false,
}: ArticleCardProps) {
  const { play } = usePlayer();
  const displayImage = hasPersistentGeneratedImage(article.generatedImageUrl)
    ? article.generatedImageUrl
    : article.imageUrl;
  const primaryAudioFile = article.audioFiles?.find(candidate => Boolean(candidate.blobUrl)) ?? null;
  const hasAudio = Boolean(primaryAudioFile);
  const isGenerating = article.imageGenerationStatus === "generating";

  const handlePlayInMiniPlayer = () => {
    if (!primaryAudioFile?.blobUrl) return;

    play({
      id: primaryAudioFile.id,
      articleId: article.id,
      articleTitle: article.title,
      articleImageUrl: displayImage ?? null,
      voiceName: primaryAudioFile.voiceName,
      blobUrl: primaryAudioFile.blobUrl,
      duration: primaryAudioFile.duration ?? 0,
    });
  };

  const cardContent = (
    <div className="netflix-aspect-portrait overflow-hidden">
      {displayImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayImage}
          alt={article.title}
          className="relative z-0 image-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,121,88,0.4),transparent_45%),linear-gradient(170deg,#141a26,#212b3d)]" />
      )}

      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#05070b] via-[#05070b]/15 to-transparent" />

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        {isGenerating && (
          <span className="netflix-badge">
            <Loader2 className="h-3 w-3 animate-spin" />
            AI
          </span>
        )}
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/45 backdrop-blur-md">
          <Play className="h-5 w-5 text-white" fill="white" />
        </div>
      </div>

      <div className="netflix-info-overlay space-y-2">
        <h3 className="line-clamp-2 text-sm font-bold text-white">{article.title}</h3>
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {Math.max(1, Math.round(article.wordCount / 200))} min
          </span>
          {hasAudio && (
            <span className="inline-flex items-center gap-1 text-white/85">
              <Waves className="h-3 w-3" />
              Ready
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <article className="netflix-carousel-item">
      <div className="netflix-card group">
        {onDeleteArticle && (
          <button
            type="button"
            onClick={() => onDeleteArticle(article)}
            disabled={deleting}
            className="absolute left-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/90 transition hover:bg-red-500/90 disabled:cursor-not-allowed disabled:opacity-70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            title="Delete article"
            aria-label={`Delete ${article.title}`}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}

        {hasAudio ? (
          <button
            type="button"
            onClick={handlePlayInMiniPlayer}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e50914]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"
          >
            {cardContent}
          </button>
        ) : (
          <Link
            href={`/voice-select/${article.id}`}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e50914]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"
          >
            {cardContent}
          </Link>
        )}
      </div>
    </article>
  );
}
