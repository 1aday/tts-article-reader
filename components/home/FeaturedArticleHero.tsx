import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { Play, Info, FileText } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

interface FeaturedArticleHeroProps {
  article: Article & {
    audioFiles?: AudioFile[];
  };
}

export function FeaturedArticleHero({ article }: FeaturedArticleHeroProps) {
  const { play } = usePlayer();
  const displayImage = article.generatedImageUrl || article.imageUrl;
  const summary = article.originalText
    ? article.originalText.slice(0, 200) + "..."
    : "Click to read and listen to this article.";
  const hasAudio = article.audioFiles && article.audioFiles.length > 0;

  const handlePlay = () => {
    if (hasAudio) {
      const audioFile = article.audioFiles![0];
      if (!audioFile.blobUrl) return; // Skip if no URL
      play({
        id: audioFile.id,
        articleId: article.id,
        articleTitle: article.title,
        voiceName: audioFile.voiceName,
        blobUrl: audioFile.blobUrl,
        duration: audioFile.duration || 0,
      });
    }
  };

  return (
    <div className="netflix-hero" style={{ backgroundImage: displayImage ? `url(${displayImage})` : 'none' }}>
      {/* Background Image or Gradient */}
      {!displayImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <FileText className="w-48 h-48 text-white" />
          </div>
        </div>
      )}

      {/* Netflix gradient overlay */}
      <div className="netflix-hero-content">
        {/* Title */}
        <h1 className="netflix-hero-title">
          {article.title}
        </h1>

        {/* Summary */}
        <p className="netflix-hero-description line-clamp-3">
          {summary}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-3">
          {hasAudio ? (
            <button onClick={handlePlay} className="netflix-button netflix-button-primary">
              <Play className="w-5 h-5" fill="white" />
              Play Now
            </button>
          ) : (
            <Link href={`/voice-select/${article.id}`}>
              <button className="netflix-button netflix-button-primary">
                Generate Audio
              </button>
            </Link>
          )}

          <Link href="/library">
            <button className="netflix-button netflix-button-secondary">
              <Info className="w-5 h-5" />
              More Info
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
