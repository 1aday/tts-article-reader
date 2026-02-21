import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import { Clock3, Loader2, Play, Waves } from "lucide-react";

interface ArticleCardProps {
  article: Article & {
    audioFiles?: AudioFile[];
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  const displayImage = hasPersistentGeneratedImage(article.generatedImageUrl)
    ? article.generatedImageUrl
    : article.imageUrl;
  const hasAudio = article.audioFiles && article.audioFiles.length > 0;
  const primaryAudioFile = hasAudio ? article.audioFiles![0] : null;
  const isGenerating = article.imageGenerationStatus === "generating";
  const href = primaryAudioFile ? `/player/${primaryAudioFile.id}` : `/voice-select/${article.id}`;

  return (
    <Link href={href} className="netflix-carousel-item">
      <article className="netflix-card group">
        <div className="netflix-aspect-portrait overflow-hidden">
          {displayImage ? (
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
            {hasAudio && primaryAudioFile && (
              <p className="text-[10px] text-white/50">{`/player/${primaryAudioFile.id}`}</p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
