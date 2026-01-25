'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeaturedArticleHero } from '@/components/home/FeaturedArticleHero';
import { ArticleCarousel } from '@/components/home/ArticleCarousel';
import { Button } from '@/components/ui/button';
import { Article, AudioFile } from '@/lib/db/schema';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type ArticleWithAudio = Article & {
  audioFiles?: AudioFile[];
};

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithAudio[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingImages, setGeneratingImages] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('[Home] Starting data fetch...');

        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );

        const fetchPromise = Promise.all([
          fetch('/api/library'),
          fetch('/api/library/filters')
        ]);

        const [articlesRes, filtersRes] = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]) as [Response, Response];

        console.log('[Home] Fetch responses received:', {
          articlesStatus: articlesRes.status,
          filtersStatus: filtersRes.status
        });

        const articlesData = await articlesRes.json();
        const filtersData = await filtersRes.json();

        console.log('[Home] Data parsed:', {
          articlesSuccess: articlesData.success,
          articleCount: articlesData.articles?.length,
          filtersSuccess: filtersData.success,
          categoryCount: filtersData.categories?.length
        });

        if (articlesData.success) {
          setArticles(articlesData.articles);

          // Auto-generate images for articles without them
          const needsImages = articlesData.articles.filter((a: any) =>
            !a.generatedImageUrl &&
            (!a.imageGenerationStatus || a.imageGenerationStatus === 'pending' || a.imageGenerationStatus === 'failed')
          );

          console.log('[Home] Articles needing images:', needsImages.length);

          if (needsImages.length > 0) {
            generateMissingImages();
          }
        }

        if (filtersData.success) {
          setCategories(filtersData.categories.map((c: any) => c.name));
        }
      } catch (error) {
        console.error('[Home] Failed to fetch data:', error);
        toast.error(
          `Failed to load library: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { duration: 5000 }
        );
      } finally {
        console.log('[Home] Setting loading to false');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const generateMissingImages = async () => {
    if (generatingImages) return;

    setGeneratingImages(true);
    toast.loading('Generating AI images for your articles...', { id: 'bulk-gen' });

    try {
      const response = await fetch('/api/article/bulk-generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: false })
      });

      const data = await response.json();

      console.log('[Home] Bulk generation result:', data);

      if (data.success) {
        const { results } = data;

        if (results.generated > 0 || results.failed > 0) {
          const message = `Generated: ${results.generated}, Failed: ${results.failed}, Skipped: ${results.skipped}`;

          if (results.failed > 0) {
            toast.warning(message, { id: 'bulk-gen', duration: 7000 });
            console.error('[Home] Generation errors:', results.errors);
          } else {
            toast.success(message, { id: 'bulk-gen', duration: 5000 });
          }
        } else {
          toast.info('All images already generated!', { id: 'bulk-gen' });
        }

        // Refresh articles after generation
        const articlesRes = await fetch('/api/library');
        const articlesData = await articlesRes.json();
        if (articlesData.success) {
          setArticles(articlesData.articles);
          console.log('[Home] Articles refreshed after generation');
        }
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('[Home] Bulk generation error:', error);
      toast.error(
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: 'bulk-gen' }
      );
    } finally {
      setGeneratingImages(false);
    }
  };

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
      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        {/* Add Article Button */}
        <Link href="/create">
          <Button
            size="lg"
            className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold shadow-2xl shadow-[#00ff88]/50 hover:shadow-[#00ff88]/70 transition-all rounded-full w-14 h-14 p-0"
            title="Add new article"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </Link>

        {/* Generate Images Button */}
        {articles.length > 0 && (
          <Button
            size="lg"
            onClick={generateMissingImages}
            disabled={generatingImages}
            className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white font-semibold shadow-2xl shadow-[#a855f7]/50 hover:shadow-[#a855f7]/70 transition-all rounded-full w-14 h-14 p-0 disabled:opacity-50"
            title="Generate AI images"
          >
            <Sparkles className={`w-6 h-6 ${generatingImages ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

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
