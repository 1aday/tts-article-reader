import { Article, AudioFile } from "@/lib/db/schema";
import { ArticleCard } from "./ArticleCard";
import Link from "next/link";

interface ArticleCarouselProps {
  title: string;
  articles: (Article & {
    audioFiles?: AudioFile[];
  })[];
}

export function ArticleCarousel({ title, articles }: ArticleCarouselProps) {
  if (articles.length === 0) return null;

  return (
    <section className="netflix-row">
      <div className="mb-2 flex items-end justify-between gap-3">
        <h2 className="netflix-row-title">{title}</h2>
        <Link
          href="/library"
          className="hidden text-xs font-semibold uppercase tracking-[0.09em] text-white/55 transition hover:text-white md:inline"
        >
          View all
        </Link>
      </div>
      <div className="netflix-carousel">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
