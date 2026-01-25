import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { Play, Loader2, FileText } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

interface ArticleCardProps {
  article: Article & {
    audioFiles?: AudioFile[];
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  const { play } = usePlayer();
  const displayImage = article.generatedImageUrl || article.imageUrl;
  const hasAudio = article.audioFiles && article.audioFiles.length > 0;
  const isGenerating = article.imageGenerationStatus === "generating";

  const handleClick = (e: React.MouseEvent) => {
    if (hasAudio) {
      e.preventDefault();
      const audioFile = article.audioFiles![0];
      if (!audioFile.blobUrl) return; // Skip if no URL
      play({
        id: audioFile.id,
        articleId: article.id,
        articleTitle: article.title,
        articleImageUrl: displayImage,
        voiceName: audioFile.voiceName,
        blobUrl: audioFile.blobUrl,
        duration: audioFile.duration || 0,
      });
    }
  };

  // If no audio, link to voice selection
  const href = hasAudio ? '#' : `/voice-select/${article.id}`;

  return (
    <Link href={href} onClick={handleClick} className="netflix-carousel-item">
      <div className="group relative netflix-aspect-portrait">
        {displayImage ? (
          <>
            {/* Generated/Featured Image */}
            <img
              src={displayImage}
              alt={article.title}
              className="image-cover"
            />
            {/* Netflix-style Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          </>
        ) : (
          <>
            {/* Placeholder Background */}
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <FileText className="w-16 h-16 text-tertiary" />
            </div>
            {/* Gradient Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          </>
        )}

        {/* Hover Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/50">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2">
            {article.title}
          </h3>
          {hasAudio && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#46d369]" />
              <span className="text-xs text-secondary">Ready to Listen</span>
            </div>
          )}
        </div>

        {/* Generation Status Badge */}
        {isGenerating && (
          <div className="absolute top-2 right-2 netflix-badge flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[10px]">AI</span>
          </div>
        )}
      </div>
    </Link>
  );
}
