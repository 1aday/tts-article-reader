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
    <div className="netflix-row">
      {/* Section Title */}
      <h2 className="netflix-row-title">
        {title}
      </h2>

      {/* Netflix Carousel */}
      <div className="netflix-carousel">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
