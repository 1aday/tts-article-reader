import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeaturedArticleHeroProps {
  article: Article & {
    audioFiles?: AudioFile[];
  };
}

export function FeaturedArticleHero({ article }: FeaturedArticleHeroProps) {
  const displayImage = article.generatedImageUrl || article.imageUrl || "/default-hero.jpg";
  const summary = article.originalText
    ? article.originalText.slice(0, 200) + "..."
    : "Click to read and listen to this article.";
  const hasAudio = article.audioFiles && article.audioFiles.length > 0;
  const firstAudioId = article.audioFiles?.[0]?.id;

  return (
    <div className="relative h-[60vh] min-h-[400px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={displayImage}
          alt={article.title}
          className="w-full h-full object-cover transition-transform hover:scale-105 duration-700"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 h-full flex items-end p-6 md:p-12">
        <div className="max-w-3xl">
          {/* Title */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 text-white drop-shadow-lg">
            {article.title}
          </h1>

          {/* Summary */}
          <p className="text-base md:text-lg text-white/90 mb-6 line-clamp-3 drop-shadow-md">
            {summary}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3 md:gap-4">
            {hasAudio ? (
              <Link href={`/player/${firstAudioId}`}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold hover:shadow-lg hover:shadow-[#00ff88]/50 transition-all"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Play Now
                </Button>
              </Link>
            ) : (
              <Link href={`/voice-select/${article.id}`}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold hover:shadow-lg hover:shadow-[#00ff88]/50 transition-all"
                >
                  Generate Audio
                </Button>
              </Link>
            )}

            <Link href="/library">
              <Button
                size="lg"
                variant="outline"
                className="text-white border-white/30 hover:bg-white/10 hover:border-white/50 backdrop-blur-sm"
              >
                <Info className="w-5 h-5 mr-2" />
                Browse Library
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
