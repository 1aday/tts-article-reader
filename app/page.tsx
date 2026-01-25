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

          // Auto-categorize articles without categories
          const needsCategorization = articlesData.articles.filter((a: any) =>
            !a.categoriesJson &&
            (!a.categorizationStatus || a.categorizationStatus === 'pending' || a.categorizationStatus === 'failed')
          );

          console.log('[Home] Articles needing categorization:', needsCategorization.length);

          if (needsCategorization.length > 0) {
            categorizeMissingArticles(needsCategorization);
          }

          // Auto-generate images for articles without them
          const needsImages = articlesData.articles.filter((a: any) =>
            !a.generatedImageUrl &&
            (!a.imageGenerationStatus || a.imageGenerationStatus === 'pending' || a.imageGenerationStatus === 'failed')
          );

          console.log('[Home] Articles needing images:', needsImages.length);

          if (needsImages.length > 0) {
            generateMissingImages(false); // Auto-generate only missing
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

  const categorizeMissingArticles = async (articlesToCategorize: any[]) => {
    console.log('[Home] Auto-categorizing articles:', articlesToCategorize.length);

    // Categorize in background (don't block UI)
    for (const article of articlesToCategorize) {
      try {
        await fetch('/api/categorization/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: article.id })
        });
        console.log(`[Home] Categorized article ${article.id}`);
      } catch (error) {
        console.error(`[Home] Failed to categorize article ${article.id}:`, error);
      }
    }

    // Refresh articles and categories after categorization
    setTimeout(async () => {
      const articlesRes = await fetch('/api/library');
      const filtersRes = await fetch('/api/library/filters');
      const articlesData = await articlesRes.json();
      const filtersData = await filtersRes.json();

      if (articlesData.success) {
        setArticles(articlesData.articles);
      }
      if (filtersData.success) {
        setCategories(filtersData.categories.map((c: any) => c.name));
      }
      console.log('[Home] Refreshed after categorization');
    }, 3000); // Wait 3 seconds for categorization to complete
  };

  const generateMissingImages = async (regenerate: boolean = false) => {
    if (generatingImages) return;

    setGeneratingImages(true);
    const message = regenerate
      ? 'Regenerating AI images for all articles...'
      : 'Generating AI images for articles without images...';
    toast.loading(message, { id: 'bulk-gen' });

    try {
      const response = await fetch('/api/article/bulk-generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate })
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
      <div className="min-h-screen bg-secondary relative overflow-hidden">
        <div className="relative flex flex-col items-center justify-center min-h-screen p-8">
          <div className="max-w-2xl text-center space-y-6">
            <h1 className="netflix-h1 mb-4">
              Welcome to{' '}
              <span className="text-netflix-red">
                TTS Article Reader
              </span>
            </h1>
            <p className="netflix-body text-xl mb-8">
              Transform web articles into natural-sounding audio with AI voices.
              Start by adding your first article.
            </p>
            <Link href="/create">
              <button className="netflix-button netflix-button-primary text-lg px-8 py-4">
                Add Your First Article
              </button>
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
    <div className="min-h-screen bg-primary pb-12">
      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        {/* Add Article Button */}
        <Link href="/create">
          <button
            className="bg-[#e50914] hover:bg-[#ff1e25] text-white font-semibold shadow-2xl transition-all rounded-full w-14 h-14 flex items-center justify-center"
            title="Add new article"
          >
            <Plus className="w-6 h-6" />
          </button>
        </Link>

        {/* Generate Images Button */}
        {articles.length > 0 && (
          <button
            onClick={() => generateMissingImages(true)} // Regenerate ALL when clicked manually
            disabled={generatingImages}
            className="bg-[#2f2f2f] hover:bg-[#3f3f3f] text-white font-semibold shadow-2xl transition-all rounded-full w-14 h-14 flex items-center justify-center disabled:opacity-50"
            title="Regenerate all AI images"
          >
            <Sparkles className={`w-6 h-6 ${generatingImages ? 'animate-spin' : ''}`} />
          </button>
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
