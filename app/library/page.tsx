"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Plus, Play, Download, Music, Loader2, Trash2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FilterBar } from "@/components/library/FilterBar";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import { downloadAudioFile } from "@/lib/download-audio";
import { usePlayer } from "@/contexts/PlayerContext";

interface AudioFile {
  id: number;
  voiceId: string;
  voiceName: string;
  blobUrl: string;
  duration: number;
  fileSize: number;
  status: string;
  createdAt: Date;
}

interface Article {
  id: number;
  title: string;
  wordCount: number;
  sourceType: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  generatedImageUrl: string | null;
  imageGenerationStatus: string | null;
  categories: string[];
  tags: string[];
  categorizationStatus: string;
  createdAt: Date;
  updatedAt: Date;
  audioFiles: AudioFile[];
}

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTrack, isStickyPlayerVisible, play, pause } = usePlayer();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const hasHandledQueryAutoplayRef = useRef(false);

  // Filter state
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image refresh state
  const [refreshingImageId, setRefreshingImageId] = useState<number | null>(null);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);

  // Image generation state
  const [generatingImageId, setGeneratingImageId] = useState<number | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const response = await fetch("/api/library");
      const data = await response.json();

      if (data.success) {
        setArticles(data.articles);
      } else {
        toast.error("Failed to load library");
      }
    } catch (error) {
      console.error("Library fetch error:", error);
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (audioId: number) => {
    try {
      await downloadAudioFile(audioId);
      toast.success("Full audio download started.");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download audio");
    }
  };

  const handlePlayAudio = useCallback((audio: AudioFile, article: Article) => {
    play({
      id: audio.id,
      articleId: article.id,
      articleTitle: article.title,
      articleImageUrl: hasPersistentGeneratedImage(article.generatedImageUrl)
        ? article.generatedImageUrl
        : article.imageUrl,
      voiceName: audio.voiceName,
      blobUrl: audio.blobUrl,
      duration: audio.duration || 0,
    });
  }, [play]);

  useEffect(() => {
    if (loading || hasHandledQueryAutoplayRef.current) return;

    const playAudioIdParam = searchParams.get("playAudioId");
    if (!playAudioIdParam) return;

    hasHandledQueryAutoplayRef.current = true;

    const playAudioId = Number(playAudioIdParam);
    if (!Number.isFinite(playAudioId) || playAudioId <= 0) {
      router.replace("/library");
      return;
    }

    const matchingArticle = articles.find((article) =>
      article.audioFiles.some((audio) => audio.id === playAudioId)
    );
    const matchingAudio = matchingArticle?.audioFiles.find((audio) => audio.id === playAudioId);

    if (matchingArticle && matchingAudio) {
      handlePlayAudio(matchingAudio, matchingArticle);
      router.replace("/library");
      return;
    }

    const playFromApi = async () => {
      try {
        const audioResponse = await fetch(`/api/audio/${playAudioId}`);
        if (!audioResponse.ok) {
          throw new Error("Failed to load requested audio");
        }

        const audio = await audioResponse.json();
        const articleResponse = await fetch(`/api/article/${audio.articleId}`);
        const article = articleResponse.ok ? await articleResponse.json() : null;

        play({
          id: audio.id,
          articleId: audio.articleId,
          articleTitle:
            typeof article?.title === "string" && article.title.trim().length > 0
              ? article.title.trim()
              : `Article ${audio.articleId}`,
          articleImageUrl: hasPersistentGeneratedImage(article?.generatedImageUrl)
            ? article.generatedImageUrl
            : article?.imageUrl ?? null,
          voiceName: audio.voiceName || "Voice narration",
          blobUrl: audio.blobUrl,
          duration: audio.duration || 0,
        });
      } catch (error) {
        console.error("Failed to start playback from playAudioId query:", error);
        toast.error("Unable to load that audio track.");
      } finally {
        router.replace("/library");
      }
    };

    void playFromApi();
  }, [articles, handlePlayAudio, loading, play, router, searchParams]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Filter handlers
  const handleCategoryToggle = (slug: string) => {
    setActiveCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleTagToggle = (slug: string) => {
    setActiveTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleClearFilters = () => {
    setActiveCategories([]);
    setActiveTags([]);
  };

  const handleRefreshImage = async (e: React.MouseEvent, articleId: number) => {
    e.stopPropagation(); // Prevent card click
    setRefreshingImageId(articleId);

    try {
      const response = await fetch("/api/article/refresh-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh image");
      }

      // Update article in local state
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId
            ? { ...article, imageUrl: data.imageUrl }
            : article
        )
      );

      toast.success("Image updated successfully!");
    } catch (error) {
      console.error("Refresh image error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh image");
    } finally {
      setRefreshingImageId(null);
    }
  };

  const handleBulkRefreshImages = async () => {
    setBulkRefreshing(true);
    toast.loading("Fetching images for all articles...", { id: "bulk-refresh" });

    try {
      const response = await fetch("/api/article/bulk-refresh-images", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh images");
      }

      // Refresh the library to get updated articles
      await fetchLibrary();

      // Show results
      const { results } = data;
      const successMessage = `Images refreshed! Updated: ${results.updated}, Failed: ${results.failed}, Skipped: ${results.skipped}`;

      toast.success(successMessage, { id: "bulk-refresh", duration: 5000 });

      if (results.errors.length > 0) {
        console.log("Bulk refresh errors:", results.errors);
      }
    } catch (error) {
      console.error("Bulk refresh error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh images", { id: "bulk-refresh" });
    } finally {
      setBulkRefreshing(false);
    }
  };

  const handleGenerateImage = async (e: React.MouseEvent, articleId: number) => {
    e.stopPropagation(); // Prevent card click
    setGeneratingImageId(articleId);
    setArticles((prev) =>
      prev.map((article) =>
        article.id === articleId
          ? { ...article, imageGenerationStatus: "generating" }
          : article
      )
    );
    const toastId = `generate-image-${articleId}`;
    toast.loading("Generating cover image...", { id: toastId });

    try {
      const response = await fetch("/api/article/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId, regenerate: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      // Update article in local state
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId
            ? {
                ...article,
                generatedImageUrl: data.imageUrl,
                imageGenerationStatus: "completed"
              }
            : article
        )
      );

      toast.success("Image generated successfully!", { id: toastId });
    } catch (error) {
      console.error("Generate image error:", error);
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId
            ? { ...article, imageGenerationStatus: "failed" }
            : article
        )
      );
      toast.error(error instanceof Error ? error.message : "Failed to generate image", { id: toastId });
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleBulkGenerateImages = async () => {
    setBulkGenerating(true);
    toast.loading("Generating AI images for all articles...", { id: "bulk-generate" });

    try {
      const response = await fetch("/api/article/bulk-generate-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regenerate: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate images");
      }

      // Refresh the library to get updated articles
      await fetchLibrary();

      // Show results
      const { results } = data;
      const successMessage = `AI images generated! Created: ${results.generated}, Failed: ${results.failed}, Skipped: ${results.skipped}`;

      toast.success(successMessage, { id: "bulk-generate", duration: 5000 });

      if (results.errors && results.errors.length > 0) {
        console.log("Bulk generation errors:", results.errors);
      }
    } catch (error) {
      console.error("Bulk generate error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate images", { id: "bulk-generate" });
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, article: Article) => {
    e.stopPropagation(); // Prevent card click
    setArticleToDelete(article);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!articleToDelete) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/article/${articleToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      toast.success("Article and all audio deleted");

      // Remove from local state
      setArticles((prev) => prev.filter((a) => a.id !== articleToDelete.id));

      // Stop playback if deleted article is currently playing in the shared player.
      if (currentTrack?.articleId === articleToDelete.id) {
        pause();
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete article");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setArticleToDelete(null);
    }
  };

  // Apply filters to articles
  const filteredArticles = articles.filter((article) => {
    // If no filters active, show all
    if (activeCategories.length === 0 && activeTags.length === 0) {
      return true;
    }

    // Convert article categories/tags to slugs for comparison
    const articleCategorySlugs = article.categories.map((cat) =>
      cat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    );
    const articleTagSlugs = article.tags.map((tag) =>
      tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    );

    // Check if article matches category filters (if any)
    const matchesCategories =
      activeCategories.length === 0 ||
      activeCategories.some((catSlug) => articleCategorySlugs.includes(catSlug));

    // Check if article matches tag filters (if any)
    const matchesTags =
      activeTags.length === 0 ||
      activeTags.some((tagSlug) => articleTagSlugs.includes(tagSlug));

    // Article must match both category AND tag filters (if specified)
    return matchesCategories && matchesTags;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.15),transparent_70%)] animate-pulse" />
        <div className="relative">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 border-4 border-[#e50914]/30 border-t-[#e50914] rounded-full animate-spin" />
            <div className="text-2xl font-semibold text-white">
              Loading library...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#141414] pt-20">
      {/* Netflix Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#141414] to-[#000000]" />

      <div className={`relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16 ${currentTrack && isStickyPlayerVisible ? 'pb-40 sm:pb-32' : ''}`}>
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:mb-12 lg:mb-14 animate-fadeInDown">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="font-display text-4xl leading-[0.96] text-white tracking-[0.03em] sm:text-5xl md:text-6xl lg:text-7xl">
              Library
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#d2d2d2] leading-relaxed">
              Your saved articles and audio files • <span className="text-[#e50914] font-semibold">{articles.length}</span> {articles.length === 1 ? "article" : "articles"}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:flex lg:w-auto">
            <Button
              onClick={() => router.push("/create")}
              size="lg"
              className="netflix-button netflix-button-primary w-full font-semibold shadow-lg lg:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">New Article</span>
              <span className="sm:hidden">New</span>
            </Button>
            {articles.some(a => a.sourceUrl) && (
              <Button
                onClick={handleBulkRefreshImages}
                disabled={bulkRefreshing}
                size="lg"
                className="netflix-button netflix-button-secondary w-full font-semibold shadow-lg disabled:opacity-50 lg:w-auto"
                title="Fetch images for all articles with URLs"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${bulkRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden lg:inline">Refresh Images</span>
                <span className="hidden sm:inline lg:hidden">Images</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
            )}
            <Button
              onClick={handleBulkGenerateImages}
              disabled={bulkGenerating}
              size="lg"
              className="netflix-button netflix-button-secondary w-full font-semibold shadow-lg disabled:opacity-50 lg:w-auto"
              title="Generate AI images for all articles"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${bulkGenerating ? "animate-spin" : ""}`} />
              <span className="hidden lg:inline">Generate AI Images</span>
              <span className="hidden sm:inline lg:hidden">AI Images</span>
              <span className="sm:hidden">Generate</span>
            </Button>
            <Button
              size="lg"
              onClick={() => router.push("/")}
              className="w-full border border-white/15 bg-transparent text-white/70 hover:bg-white/10 hover:text-white lg:w-auto lg:border-0"
              aria-label="Go to home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Home</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        {articles.length > 0 && (
          <FilterBar
            activeCategories={activeCategories}
            activeTags={activeTags}
            onCategoryToggle={handleCategoryToggle}
            onTagToggle={handleTagToggle}
            onClearAll={handleClearFilters}
          />
        )}

        {articles.length === 0 ? (
          <div className="bg-[#2f2f2f] backdrop-blur-md border border-[#404040] rounded-3xl p-12 sm:p-16 md:p-20 shadow-2xl animate-fadeInUp">
            <div className="text-center space-y-8 sm:space-y-10">
              <div className="flex justify-center">
                <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full bg-[#181818] border-2 border-[#e50914]/30 flex items-center justify-center">
                  <FileText className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 text-[#808080]" />
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                  No articles yet
                </h2>
                <p className="text-lg sm:text-xl text-[#d2d2d2] max-w-md mx-auto px-4 leading-relaxed">
                  Create your first article to start building your audio library
                </p>
              </div>
              <Button
                size="xl"
                onClick={() => router.push("/create")}
                className="netflix-button netflix-button-primary font-bold shadow-2xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Article
              </Button>
            </div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="animate-fadeInUp py-16 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <FileText className="h-7 w-7 text-white/45" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white">No matching articles</h2>
            <p className="mt-2 text-white/60">Try adjusting filters to show more results.</p>
            <Button
              size="lg"
              onClick={handleClearFilters}
              className="mt-6 netflix-button netflix-button-primary font-semibold"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-12 sm:space-y-16">
            {/* Filtered count */}
            {(activeCategories.length > 0 || activeTags.length > 0) && (
              <div className="text-sm text-white/60">
                Showing <span className="text-[#e50914] font-semibold">{filteredArticles.length}</span> of {articles.length} articles
              </div>
            )}

            {/* Grid view with Netflix-style cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {filteredArticles.map((article, index) => (
                <div
                  key={article.id}
                  className={`group relative overflow-hidden rounded-2xl bg-surface-1/90 border border-white/10 hover:border-[#e50914]/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.42)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer animate-fadeInUp stagger-${index % 6 + 1}`}
                  onClick={() => {
                    // Click card to start sticky playback when audio exists
                    if (article.audioFiles.length > 0) {
                      handlePlayAudio(article.audioFiles[0], article);
                    } else {
                      router.push(`/voice-select/${article.id}`);
                    }
                  }}
                >
                  {/* Featured Image */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-[#e50914]/25 to-[#b20710]/25">
                    {(hasPersistentGeneratedImage(article.generatedImageUrl) ? article.generatedImageUrl : article.imageUrl) ? (
                      <img
                        src={(hasPersistentGeneratedImage(article.generatedImageUrl) ? article.generatedImageUrl : article.imageUrl) || ''}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          // Fallback to gradient if image fails to load
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-[#e50914]/40" />
                      </div>
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />

                    {/* Action Buttons */}
                    <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, article)}
                        className="w-8 h-8 bg-black/55 hover:bg-red-500/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Delete article"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Refresh Image Button - Only show if article has a source URL */}
                      {article.sourceUrl && (
                        <button
                          onClick={(e) => handleRefreshImage(e, article.id)}
                          disabled={refreshingImageId === article.id}
                          className={`w-8 h-8 text-white rounded-full flex items-center justify-center transition-all duration-200 ${
                            !article.imageUrl
                              ? "bg-[#e50914]/90 hover:bg-[#e50914] opacity-100"
                              : "bg-[#e50914]/90 hover:bg-[#e50914] opacity-0 group-hover:opacity-100"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={article.imageUrl ? "Refresh image" : "Fetch image"}
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingImageId === article.id ? "animate-spin" : ""}`} />
                        </button>
                      )}

                      {/* Generate AI Image Button */}
                      <button
                        onClick={(e) => handleGenerateImage(e, article.id)}
                        disabled={generatingImageId === article.id || article.imageGenerationStatus === "generating"}
                        className={`w-8 h-8 text-white rounded-full flex items-center justify-center transition-all duration-200 ${
                          !hasPersistentGeneratedImage(article.generatedImageUrl)
                          || generatingImageId === article.id
                          || article.imageGenerationStatus === "generating"
                            ? "bg-[#e50914]/90 hover:bg-[#e50914] opacity-100"
                            : "bg-[#e50914]/90 hover:bg-[#e50914] opacity-0 group-hover:opacity-100"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={hasPersistentGeneratedImage(article.generatedImageUrl) ? "Regenerate AI image" : "Generate AI image"}
                      >
                        {generatingImageId === article.id || article.imageGenerationStatus === "generating" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Audio Status Badge */}
                    {article.audioFiles.length > 0 && (
                      <div className="absolute top-3 right-3 bg-black/65 text-white px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
                        <Music className="w-3 h-3 text-[#e50914]" />
                        {article.audioFiles.length}
                      </div>
                    )}
                  </div>

                  {/* Article Info */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xl sm:text-2xl font-semibold text-white line-clamp-2 group-hover:text-[#ff6a70] transition-colors">
                        {article.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                        <span>{article.wordCount.toLocaleString()} words</span>
                        <span>{formatDate(article.createdAt)}</span>
                        {article.sourceUrl && <span>URL</span>}
                      </div>
                    </div>

                    {(article.categories.length > 0 || article.tags.length > 0) && (
                      <div className="text-[11px] text-white/50">
                        {article.categories.slice(0, 1).join("")}
                        {article.categories.length > 0 && article.tags.length > 0 ? " · " : ""}
                        {article.tags.length > 0 ? `${article.tags.length} tags` : ""}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      {article.audioFiles.length > 0 ? (
                        <>
                          <Button
                            onClick={() => handlePlayAudio(article.audioFiles[0], article)}
                            size="sm"
                            className="flex-1 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white hover:opacity-90 font-semibold"
                          >
                            <Play className="w-3.5 h-3.5 mr-1.5" fill="white" />
                            Play Audio
                          </Button>
                          <Button
                            onClick={() => handleDownload(article.audioFiles[0].id)}
                            size="sm"
                            variant="outline"
                            className="flex-1 border-white/20 text-white/80 hover:bg-white/8 hover:text-white"
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5 text-[#e50914]" />
                            Download
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => router.push(`/voice-select/${article.id}`)}
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white hover:opacity-90 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Generate Audio
                        </Button>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Article"
        message={`This will permanently delete "${articleToDelete?.title}" and all ${articleToDelete?.audioFiles.length || 0} audio file(s). This action cannot be undone.`}
        confirmText="Delete Everything"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
