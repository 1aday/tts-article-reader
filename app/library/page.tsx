"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Plus, Play, Download, Music, Calendar, Link as LinkIcon, Pause, SkipBack, SkipForward, Volume2, Maximize2, Loader2, Trash2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FilterBar } from "@/components/library/FilterBar";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

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

interface NowPlaying {
  audio: AudioFile;
  article: Article;
}

export default function LibraryPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const handleDownload = async (blobUrl: string, articleId: number, voiceName: string) => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `article-${articleId}-${voiceName}.mp3`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Audio downloaded!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download audio");
    }
  };

  const handlePlayAudio = (audio: AudioFile, article: Article) => {
    if (nowPlaying?.audio.id === audio.id) {
      // Toggle play/pause for current track
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      // Play new track
      setNowPlaying({ audio, article });
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    if (nowPlaying && audioRef.current) {
      // Use proxy for CORS compatibility
      const proxyUrl = `/api/audio/proxy?url=${encodeURIComponent(nowPlaying.audio.blobUrl)}`;
      audioRef.current.src = proxyUrl;
      audioRef.current.load(); // Force reload
      audioRef.current.play().catch((error) => {
        console.error("Playback error:", error);
        toast.error("Failed to play audio. Try downloading instead.");
      });
    }
  }, [nowPlaying]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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

      toast.success("Image generated successfully!");
    } catch (error) {
      console.error("Generate image error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate image");
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

      // Stop playback if deleted article was playing
      if (nowPlaying?.article.id === articleToDelete.id) {
        setNowPlaying(null);
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
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
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.12),transparent_50%)] animate-pulse" />
        <div className="relative">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 border-4 border-[#00ff88]/20 border-t-[#00ff88] rounded-full animate-spin" />
            <div className="text-2xl font-semibold gradient-terminal">
              Loading library...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden pt-16">
      {/* Enhanced Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,212,255,0.08),transparent_50%)]" />

      <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 ${nowPlaying ? 'pb-40 sm:pb-32' : ''}`}>
        {/* Enhanced Header */}
        <div className="flex items-center justify-between mb-12 sm:mb-16 md:mb-20 animate-fadeInDown">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold gradient-terminal tracking-tight">
              Library
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/70 leading-relaxed">
              Your saved articles and audio files • <span className="text-[#00ff88] font-semibold">{articles.length}</span> {articles.length === 1 ? "article" : "articles"}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button
              onClick={() => router.push("/create")}
              size="lg"
              className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 font-semibold shadow-lg"
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
                className="bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20 border border-[#00d4ff]/30 font-semibold shadow-lg disabled:opacity-50"
                title="Fetch images for all articles with URLs"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${bulkRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden lg:inline">Refresh Images</span>
                <span className="hidden sm:inline lg:hidden">Images</span>
              </Button>
            )}
            <Button
              onClick={handleBulkGenerateImages}
              disabled={bulkGenerating}
              size="lg"
              className="bg-[#a855f7]/10 text-[#a855f7] hover:bg-[#a855f7]/20 border border-[#a855f7]/30 font-semibold shadow-lg disabled:opacity-50"
              title="Generate AI images for all articles"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${bulkGenerating ? "animate-spin" : ""}`} />
              <span className="hidden lg:inline">Generate AI Images</span>
              <span className="hidden sm:inline lg:hidden">AI Images</span>
            </Button>
            <Button
              size="lg"
              onClick={() => router.push("/")}
              className="bg-transparent text-white/70 hover:text-white hover:bg-white/10 border-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Home</span>
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
          <div className="bg-surface-1 backdrop-blur-md border-2 border-white/10 rounded-3xl p-12 sm:p-16 md:p-20 shadow-2xl animate-fadeInUp">
            <div className="text-center space-y-8 sm:space-y-10">
              <div className="flex justify-center animate-float">
                <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full bg-surface-2 border-2 border-[#00ff88]/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                  <FileText className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 text-[#00ff88]/60" />
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold gradient-terminal">
                  No articles yet
                </h2>
                <p className="text-lg sm:text-xl text-white/60 max-w-md mx-auto px-4 leading-relaxed">
                  Create your first article to start building your audio library
                </p>
              </div>
              <Button
                size="xl"
                onClick={() => router.push("/create")}
                className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 font-bold shadow-2xl shadow-[#00ff88]/30 animate-glow"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Article
              </Button>
            </div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-surface-1 backdrop-blur-md border-2 border-white/10 rounded-3xl p-12 sm:p-16 md:p-20 shadow-2xl animate-fadeInUp">
            <div className="text-center space-y-8 sm:space-y-10">
              <div className="flex justify-center animate-float">
                <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full bg-surface-2 border-2 border-[#00ff88]/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                  <FileText className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 text-[#00ff88]/60" />
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold gradient-terminal">
                  No matching articles
                </h2>
                <p className="text-lg sm:text-xl text-white/60 max-w-md mx-auto px-4 leading-relaxed">
                  Try adjusting your filters to see more results
                </p>
              </div>
              <Button
                size="xl"
                onClick={handleClearFilters}
                className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 font-bold shadow-2xl shadow-[#00ff88]/30"
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-12 sm:space-y-16">
            {/* Filtered count */}
            {(activeCategories.length > 0 || activeTags.length > 0) && (
              <div className="text-sm text-white/60">
                Showing <span className="text-[#00ff88] font-semibold">{filteredArticles.length}</span> of {articles.length} articles
              </div>
            )}

            {/* Grid view with Netflix-style cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredArticles.map((article, index) => (
                <div
                  key={article.id}
                  className={`group relative overflow-hidden rounded-2xl bg-surface-1 border-2 border-white/10 hover:border-[#00ff88]/40 hover:shadow-[0_0_40px_rgba(0,255,136,0.3)] transition-all duration-500 hover:scale-105 cursor-pointer animate-fadeInUp stagger-${index % 6 + 1}`}
                  onClick={() => {
                    // Click card to play inline if audio exists
                    if (article.audioFiles.length > 0) {
                      handlePlayAudio(article.audioFiles[0], article);
                    } else {
                      router.push(`/voice-select/${article.id}`);
                    }
                  }}
                >
                  {/* Featured Image */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#00ff88]/20 to-[#00d4ff]/20">
                    {(article.generatedImageUrl || article.imageUrl) ? (
                      <img
                        src={article.generatedImageUrl || article.imageUrl || ''}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          // Fallback to gradient if image fails to load
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-[#00ff88]/40" />
                      </div>
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />

                    {/* Action Buttons */}
                    <div className="absolute top-4 left-4 flex gap-2 z-10">
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, article)}
                        className="w-10 h-10 bg-red-500/90 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:scale-110"
                        title="Delete article"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      {/* Refresh Image Button - Only show if article has a source URL */}
                      {article.sourceUrl && (
                        <button
                          onClick={(e) => handleRefreshImage(e, article.id)}
                          disabled={refreshingImageId === article.id}
                          className={`w-10 h-10 text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:scale-110 ${
                            !article.imageUrl
                              ? "bg-[#00d4ff]/90 hover:bg-[#00d4ff] opacity-100"
                              : "bg-[#00d4ff]/90 hover:bg-[#00d4ff] opacity-0 group-hover:opacity-100"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={article.imageUrl ? "Refresh image" : "Fetch image"}
                        >
                          <RefreshCw className={`w-5 h-5 ${refreshingImageId === article.id ? "animate-spin" : ""}`} />
                        </button>
                      )}

                      {/* Generate AI Image Button */}
                      <button
                        onClick={(e) => handleGenerateImage(e, article.id)}
                        disabled={generatingImageId === article.id || article.imageGenerationStatus === "generating"}
                        className={`w-10 h-10 text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:scale-110 ${
                          !article.generatedImageUrl
                            ? "bg-[#a855f7]/90 hover:bg-[#a855f7] opacity-100"
                            : "bg-[#a855f7]/90 hover:bg-[#a855f7] opacity-0 group-hover:opacity-100"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={article.generatedImageUrl ? "Regenerate AI image" : "Generate AI image"}
                      >
                        {generatingImageId === article.id || article.imageGenerationStatus === "generating" ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Audio Status Badge */}
                    {article.audioFiles.length > 0 && (
                      <div className="absolute top-4 right-4 bg-[#00ff88] text-black px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <Music className="w-3 h-3" />
                        {article.audioFiles.length}
                      </div>
                    )}
                  </div>

                  {/* Article Info */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-white line-clamp-2 group-hover:text-[#00ff88] transition-colors">
                        {article.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/60">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#00ff88]" />
                          {article.wordCount.toLocaleString()}
                        </span>
                        <span className="text-white/30">•</span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#00d4ff]" />
                          {formatDate(article.createdAt)}
                        </span>
                        {article.sourceUrl && (
                          <>
                            <span className="text-white/30">•</span>
                            <span className="flex items-center gap-1.5">
                              <LinkIcon className="w-3.5 h-3.5 text-[#a855f7]" />
                              URL
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Categories and Tags */}
                    {(article.categories.length > 0 || article.tags.length > 0 || article.categorizationStatus !== "completed") && (
                      <div className="flex flex-wrap gap-2 pt-3">
                        {/* Categorizing Status */}
                        {article.categorizationStatus === "processing" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Categorizing...
                          </span>
                        )}
                        {article.categorizationStatus === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Pending...
                          </span>
                        )}

                        {/* Category Badges (max 2) */}
                        {article.categories.slice(0, 2).map((category, idx) => (
                          <span
                            key={`cat-${idx}`}
                            className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 text-[#00ff88] border border-[#00ff88]/30"
                          >
                            {category}
                          </span>
                        ))}

                        {/* Tag Badges (max 3) */}
                        {article.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={`tag-${idx}`}
                            className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          >
                            {tag}
                          </span>
                        ))}

                        {/* More indicator */}
                        {(article.categories.length > 2 || article.tags.length > 3) && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/10 text-white/60 border border-white/20">
                            +{(article.categories.length > 2 ? article.categories.length - 2 : 0) + (article.tags.length > 3 ? article.tags.length - 3 : 0)} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                      {article.audioFiles.length > 0 ? (
                        <>
                          <Button
                            onClick={() => handlePlayAudio(article.audioFiles[0], article)}
                            size="sm"
                            className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 font-semibold shadow-lg"
                          >
                            <Play className="w-3.5 h-3.5 mr-1.5" fill="black" />
                            Play
                          </Button>
                          <Button
                            onClick={() => handleDownload(article.audioFiles[0].blobUrl, article.id, article.audioFiles[0].voiceName)}
                            size="sm"
                            variant="outline"
                            className="flex-1 border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10"
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => router.push(`/voice-select/${article.id}`)}
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 font-semibold"
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

      {/* Integrated Audio Player - Fixed at Bottom */}
      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t-2 border-[#00ff88]/30 backdrop-blur-xl z-50 shadow-2xl shadow-[#00ff88]/20 animate-slideInFromBottom">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Track Info */}
              <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-[#00ff88]/20 to-[#00d4ff]/20 flex items-center justify-center border-2 border-[#00ff88]/30 flex-shrink-0">
                  <Music className="w-7 h-7 sm:w-8 sm:h-8 text-[#00ff88]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base sm:text-lg font-bold text-white truncate">
                    {nowPlaying.article.title}
                  </div>
                  <div className="text-sm text-white/60 truncate">
                    {nowPlaying.audio.voiceName}
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex flex-col items-center gap-2 flex-1 w-full sm:w-auto">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white/70 hover:text-white w-8 h-8 sm:w-10 sm:h-10"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                      }
                    }}
                  >
                    <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <Button
                    size="icon"
                    onClick={togglePlayPause}
                    className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 rounded-full shadow-lg shadow-[#00ff88]/30"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6" fill="black" />
                    ) : (
                      <Play className="w-5 h-5 sm:w-6 sm:h-6" fill="black" />
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white/70 hover:text-white w-8 h-8 sm:w-10 sm:h-10"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
                      }
                    }}
                  >
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 w-full max-w-md">
                  <span className="text-xs text-white/50 min-w-[40px]">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00ff88] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,136,0.5)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                  />
                  <span className="text-xs text-white/50 min-w-[40px] text-right">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Volume & Actions */}
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-white/60" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00d4ff] [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => router.push(`/player/${nowPlaying.audio.id}`)}
                  className="text-white/70 hover:text-white w-8 h-8 sm:w-10 sm:h-10"
                  title="Full Player"
                >
                  <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onError={(e) => {
          console.error("Audio playback error:", e);
          toast.error("Failed to load audio. Please try downloading instead.");
        }}
        onLoadStart={() => console.log("Audio loading started")}
        onCanPlay={() => console.log("Audio can play")}
      />

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
