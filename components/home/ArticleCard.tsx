import Link from "next/link";
import { Article, AudioFile } from "@/lib/db/schema";
import { Play, Loader2 } from "lucide-react";

interface ArticleCardProps {
  article: Article & {
    audioFiles?: AudioFile[];
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  const displayImage = article.generatedImageUrl || article.imageUrl || "/default-card.jpg";
  const hasAudio = article.audioFiles && article.audioFiles.length > 0;
  const isGenerating = article.imageGenerationStatus === "generating";

  // Link to player if audio exists, otherwise to voice selection
  const href = hasAudio
    ? `/player/${article.audioFiles![0].id}`
    : `/voice-select/${article.id}`;

  return (
    <Link href={href} className="carousel-card">
      <div className="group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer bg-neutral-900">
        {/* Generated/Featured Image */}
        <img
          src={displayImage}
          alt={article.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300"
          onError={(e) => {
            // Fallback to placeholder on image load error
            e.currentTarget.src = "/default-card.jpg";
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Hover Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Play className="w-7 h-7 md:w-8 md:h-8 text-white fill-white ml-1" />
          </div>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
          <h3 className="text-xs md:text-sm font-semibold text-white line-clamp-2 drop-shadow-lg">
            {article.title}
          </h3>
        </div>

        {/* Generation Status Badge */}
        {isGenerating && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating...
          </div>
        )}
      </div>
    </Link>
  );
}
