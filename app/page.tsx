'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeaturedArticleHero } from '@/components/home/FeaturedArticleHero';
import { ArticleCarousel } from '@/components/home/ArticleCarousel';
import { Button } from '@/components/ui/button';
import { Article, AudioFile } from '@/lib/db/schema';

type ArticleWithAudio = Article & {
  audioFiles?: AudioFile[];
};

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithAudio[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [articlesRes, filtersRes] = await Promise.all([
          fetch('/api/library'),
          fetch('/api/library/filters')
        ]);

        const articlesData = await articlesRes.json();
        const filtersData = await filtersRes.json();

        if (articlesData.success) {
          setArticles(articlesData.articles);
        }

        if (filtersData.success) {
          setCategories(filtersData.categories.map((c: any) => c.name));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading your library...</div>
      </div>
    );
  }

  // Empty state: Show welcome screen
  if (articles.length === 0) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,212,255,0.12),transparent_50%)]" />

        <div className="relative flex flex-col items-center justify-center min-h-screen p-8">
          <div className="max-w-2xl text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] bg-clip-text text-transparent">
                TTS Article Reader
              </span>
            </h1>
            <p className="text-lg text-white/60 mb-8">
              Transform web articles into natural-sounding audio with AI voices.
              Start by adding your first article.
            </p>
            <Link href="/create">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold text-lg hover:shadow-lg hover:shadow-[#00ff88]/50 transition-all"
              >
                Add Your First Article
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Sort articles by creation date (newest first)
  const recentArticles = [...articles].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const featuredArticle = recentArticles[0];

  // Filter articles with audio for "Popular" section
  const articlesWithAudio = articles.filter(a => a.audioFiles && a.audioFiles.length > 0);

  return (
    <div className="min-h-screen bg-black pb-12">
      {/* Featured Hero */}
      <FeaturedArticleHero article={featuredArticle} />

      {/* Content Sections */}
      <div className="space-y-8 md:space-y-12 pt-8 md:pt-12">
        {/* Recently Added */}
        <ArticleCarousel
          title="Recently Added"
          articles={recentArticles.slice(0, 12)}
        />

        {/* By Category */}
        {categories.map(category => {
          const categoryArticles = articles.filter(article => {
            try {
              const cats = article.categoriesJson ? JSON.parse(article.categoriesJson) : [];
              return cats.includes(category);
            } catch {
              return false;
            }
          });

          if (categoryArticles.length === 0) return null;

          return (
            <ArticleCarousel
              key={category}
              title={category}
              articles={categoryArticles.slice(0, 12)}
            />
          );
        })}

        {/* Articles with Audio */}
        {articlesWithAudio.length > 0 && (
          <ArticleCarousel
            title="Ready to Listen"
            articles={articlesWithAudio.slice(0, 12)}
          />
        )}
      </div>
    </div>
  );
}
