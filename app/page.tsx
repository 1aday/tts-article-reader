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
  categories?: string[];
  tags?: string[];
};

type FilterCategory = {
  name: string;
};

type HomeDataPayload = {
  articles: ArticleWithAudio[];
  categories: string[];
};

type HomeCache = HomeDataPayload & {
  cachedAt: number;
};

const HOME_CACHE_TTL_MS = 90_000;

let homeCache: HomeCache | null = null;
let homeDataFetchPromise: Promise<HomeDataPayload> | null = null;

const isHomeCacheFresh = (cache: HomeCache | null): cache is HomeCache =>
  Boolean(cache && Date.now() - cache.cachedAt < HOME_CACHE_TTL_MS);

const fetchHomeDataFromApi = async (): Promise<HomeDataPayload> => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), 10000)
  );

  const fetchPromise = Promise.all([
    fetch('/api/library'),
    fetch('/api/library/filters'),
  ]);

  const [articlesRes, filtersRes] = (await Promise.race([
    fetchPromise,
    timeoutPromise,
  ])) as [Response, Response];

  if (!articlesRes.ok || !filtersRes.ok) {
    throw new Error(`Request failed (${articlesRes.status}/${filtersRes.status})`);
  }

  const articlesData = await articlesRes.json();
  const filtersData = await filtersRes.json();

  if (!articlesData.success) {
    throw new Error('Library request failed');
  }

  if (!filtersData.success) {
    throw new Error('Filters request failed');
  }

  const filterCategories = (filtersData.categories ?? []) as FilterCategory[];

  return {
    articles: (articlesData.articles ?? []) as ArticleWithAudio[],
    categories: filterCategories.map((category) => category.name),
  };
};

const getHomeData = async (forceRefresh = false): Promise<HomeDataPayload> => {
  if (!forceRefresh && isHomeCacheFresh(homeCache)) {
    return {
      articles: homeCache.articles,
      categories: homeCache.categories,
    };
  }

  if (!homeDataFetchPromise) {
    homeDataFetchPromise = fetchHomeDataFromApi()
      .then((payload) => {
        homeCache = {
          ...payload,
          cachedAt: Date.now(),
        };
        return payload;
      })
      .finally(() => {
        homeDataFetchPromise = null;
      });
  }

  return homeDataFetchPromise;
};

export default function Home() {
  const [articles, setArticles] = useState<ArticleWithAudio[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingImages, setGeneratingImages] = useState(false);

  const applyHomeData = (data: HomeDataPayload) => {
    setArticles(data.articles);
    setCategories(data.categories);
  };

  useEffect(() => {
    async function fetchData() {
      const cachedData = homeCache
        ? {
            articles: homeCache.articles,
            categories: homeCache.categories,
          }
        : null;

      if (cachedData) {
        applyHomeData(cachedData);
        setLoading(false);
      }

      const shouldRefresh = !isHomeCacheFresh(homeCache);
      if (!shouldRefresh) return;

      try {
        const fetchedData = await getHomeData(true);
        const fetchedArticles = fetchedData.articles;
        applyHomeData(fetchedData);

        // Auto-categorize articles without categories
        const needsCategorization = fetchedArticles.filter((article) =>
          !article.categoriesJson &&
          (!article.categorizationStatus ||
            article.categorizationStatus === 'pending' ||
            article.categorizationStatus === 'failed')
        );

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

        if (needsImages.length > 0) {
          generateMissingImages(false); // Auto-generate only missing
        }
      } catch (error) {
        console.error('[Home] Failed to fetch data:', error);
        if (!cachedData) {
          toast.error(
            `Failed to load library: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { duration: 5000 }
          );
        }
      } finally {
        if (!cachedData) {
          setLoading(false);
        }
      }
    }

    fetchData();
    // Intentional one-time bootstrap load with module-level cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      try {
        const refreshedData = await getHomeData(true);
        applyHomeData(refreshedData);
      } catch (error) {
        console.error('[Home] Failed to refresh after categorization:', error);
      }
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
        const refreshedData = await getHomeData(true);
        applyHomeData(refreshedData);
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
            <div className="grid gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-white/65 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:text-sm">
              <span>{articles.length} saved articles</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:block" />
              <span>{categories.length} active categories</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:block" />
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
            if (Array.isArray(article.categories)) {
              return article.categories.includes(category);
            }

            if (!article.categoriesJson) return false;

            try {
              const parsed = JSON.parse(article.categoriesJson);
              return Array.isArray(parsed) && parsed.includes(category);
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
