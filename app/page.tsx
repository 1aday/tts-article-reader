'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeaturedArticleHero } from '@/components/home/FeaturedArticleHero';
import { ArticleCarousel } from '@/components/home/ArticleCarousel';
import { Article, AudioFile } from '@/lib/db/schema';
import { hasPersistentGeneratedImage } from '@/lib/utils/image-url';
import { Plus, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

type ArticleWithAudio = Article & {
  audioFiles?: AudioFile[];
};

type FilterCategory = {
  name: string;
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
          const fetchedArticles = (articlesData.articles ?? []) as ArticleWithAudio[];
          setArticles(fetchedArticles);

          // Auto-categorize articles without categories
          const needsCategorization = fetchedArticles.filter((article) =>
            !article.categoriesJson &&
            (!article.categorizationStatus ||
              article.categorizationStatus === 'pending' ||
              article.categorizationStatus === 'failed')
          );

          console.log('[Home] Articles needing categorization:', needsCategorization.length);

          if (needsCategorization.length > 0) {
            categorizeMissingArticles(needsCategorization);
          }

          // Auto-generate images for articles without them
          const needsImages = fetchedArticles.filter((article) =>
            !hasPersistentGeneratedImage(article.generatedImageUrl) &&
            (!article.imageGenerationStatus ||
              article.imageGenerationStatus === 'pending' ||
              article.imageGenerationStatus === 'failed')
          );

          console.log('[Home] Articles needing images:', needsImages.length);

          if (needsImages.length > 0) {
            generateMissingImages(false); // Auto-generate only missing
          }
        }

        if (filtersData.success) {
          const filterCategories = (filtersData.categories ?? []) as FilterCategory[];
          setCategories(filterCategories.map((category) => category.name));
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

  const categorizeMissingArticles = async (articlesToCategorize: Array<{ id: number }>) => {
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
        const filterCategories = (filtersData.categories ?? []) as FilterCategory[];
        setCategories(filterCategories.map((category) => category.name));
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
      <div className="min-h-screen bg-primary flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-surface-1/80 px-8 py-6 text-center shadow-2xl">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e50914]/40 bg-[#e50914]/15">
            <Wand2 className="h-5 w-5 animate-pulse text-[#e50914]" />
          </div>
          <div className="text-lg font-semibold text-white">Loading your library...</div>
        </div>
      </div>
    );
  }

  // Empty state: Show welcome screen
  if (articles.length === 0) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-secondary pt-16">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-6 py-16">
          <div className="w-full rounded-[2rem] border border-white/10 bg-gradient-to-br from-surface-1/95 via-surface-2/90 to-surface-1/95 p-10 text-center shadow-[0_40px_90px_rgba(3,6,14,0.65)] sm:p-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/70">
              New Workspace
            </div>
            <h1 className="netflix-h1 mb-4">
              Build Your
              <span className="block text-netflix-red"> Listening Catalog</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl netflix-body text-lg sm:text-xl">
              Drop an article URL or paste text, pick a voice, and create premium audio in minutes.
            </p>
            <Link href="/create" className="netflix-button netflix-button-primary px-8 py-4 text-base sm:text-lg">
              <Plus className="h-5 w-5" />
              Add your first article
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
      <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3 sm:bottom-8 sm:right-8">
        <Link href="/create">
          <button
            className="group inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e50914]/40 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white shadow-[0_18px_32px_rgba(229,9,20,0.4)] transition hover:-translate-y-0.5"
            title="Add new article"
          >
            <Plus className="h-6 w-6 transition group-hover:rotate-90" />
          </button>
        </Link>

        {articles.length > 0 && (
          <button
            onClick={() => generateMissingImages(true)}
            disabled={generatingImages}
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-surface-2/90 text-white shadow-[0_14px_28px_rgba(5,8,15,0.5)] transition hover:-translate-y-0.5 hover:border-[#e50914]/45 disabled:opacity-50"
            title="Regenerate all AI images"
          >
            <Sparkles className={`w-6 h-6 ${generatingImages ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <FeaturedArticleHero article={featuredArticle} />

      <div className="space-y-8 pt-8 md:space-y-12 md:pt-12">
        <section className="netflix-row">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-surface-1/85 via-surface-2/75 to-surface-1/85 px-5 py-4 shadow-lg sm:px-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-white/65 sm:text-sm">
              <span>{articles.length} saved articles</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>{categories.length} active categories</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>{articlesWithAudio.length} ready to listen</span>
            </div>
          </div>
        </section>

        <ArticleCarousel
          title="Recently Added"
          articles={recentArticles.slice(0, 12)}
        />

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
