import { Article, AudioFile } from "@/lib/db/schema";
import { ArticleCard } from "./ArticleCard";

interface ArticleCarouselProps {
  title: string;
  articles: (Article & {
    audioFiles?: AudioFile[];
  })[];
}

export function ArticleCarousel({ title, articles }: ArticleCarouselProps) {
  if (articles.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      {/* Section Title */}
      <h2 className="text-xl md:text-2xl font-bold text-white px-4 md:px-8">
        {title}
      </h2>

      {/* Scrollable Card Container */}
      <div className="carousel-container px-4 md:px-8">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
