"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Article, AudioFile } from "@/lib/db/schema";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import { formatDuration } from "@/lib/audio-duration";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";

type ArticleWithAudio = Article & {
  audioFiles?: AudioFile[];
};

interface FeaturedArticleHeroProps {
  article: ArticleWithAudio;
  showcaseArticles?: ArticleWithAudio[];
  onDeleteArticle?: (article: ArticleWithAudio) => void;
  deleting?: boolean;
}

type HeroSlide = {
  id: number;
  title: string;
  summary: string;
  wordCount: number;
  image: string | null;
  audioFile: AudioFile | null;
  source: ArticleWithAudio;
};

export function FeaturedArticleHero({
  article,
  showcaseArticles = [],
  onDeleteArticle,
  deleting = false,
}: FeaturedArticleHeroProps) {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    muted,
    play,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
  } = usePlayer();
  const [activeIndex, setActiveIndex] = useState(0);

  const getDisplayImage = (target: ArticleWithAudio) =>
    hasPersistentGeneratedImage(target.generatedImageUrl)
      ? target.generatedImageUrl
      : target.imageUrl;

  const heroSlides = useMemo<HeroSlide[]>(() => {
    return [article, ...showcaseArticles]
      .filter((target, index, allTargets) =>
        allTargets.findIndex(candidate => candidate.id === target.id) === index
      )
      .slice(0, 8)
      .map(target => {
        const slideAudioFile = target.audioFiles?.find(candidate => Boolean(candidate.blobUrl)) ?? null;
        const slideSummary = target.originalText
          ? `${target.originalText.slice(0, 220)}...`
          : "Studio-grade narration, synced progress, and instant resume across devices.";

        return {
          id: target.id,
          title: target.title,
          summary: slideSummary,
          wordCount: target.wordCount,
          image: getDisplayImage(target),
          audioFile: slideAudioFile,
          source: target,
        };
      });
  }, [article, showcaseArticles]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex(currentIndex => (currentIndex + 1) % heroSlides.length);
    }, 7500);

    return () => clearInterval(timer);
  }, [heroSlides.length]);

  if (heroSlides.length === 0) return null;

  const safeActiveIndex = ((activeIndex % heroSlides.length) + heroSlides.length) % heroSlides.length;
  const activeSlide = heroSlides[safeActiveIndex] ?? heroSlides[0];
  const hasAudio = Boolean(activeSlide.audioFile);
  const heroTrack = activeSlide.audioFile
    ? {
        id: activeSlide.audioFile.id,
        articleId: activeSlide.id,
        articleTitle: activeSlide.title,
        articleImageUrl: activeSlide.image ?? null,
        voiceName: activeSlide.audioFile.voiceName,
        blobUrl: activeSlide.audioFile.blobUrl!,
        duration: activeSlide.audioFile.duration ?? Math.max(30, Math.round(activeSlide.wordCount / 200) * 60),
      }
    : null;
  const isHeroTrackActive = Boolean(heroTrack && currentTrack?.id === heroTrack.id);
  const effectiveDuration = isHeroTrackActive
    ? (duration > 0 ? duration : heroTrack?.duration ?? 0)
    : (heroTrack?.duration ?? 0);
  const progress = effectiveDuration > 0 && isHeroTrackActive
    ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
    : 0;
  const currentVolume = muted ? 0 : volume;
  const playerCurrentTime = isHeroTrackActive ? currentTime : 0;
  const isVisualizerActive = isHeroTrackActive && isPlaying;

  const handlePrimaryPlayback = () => {
    if (!heroTrack) return;
    if (isHeroTrackActive) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }
    play(heroTrack);
  };

  const handleSeek = (nextTime: number) => {
    if (!heroTrack) return;
    if (!isHeroTrackActive) {
      play(heroTrack);
      seek(nextTime);
      return;
    }
    seek(nextTime);
  };

  const skipBy = (seconds: number) => {
    if (!heroTrack) return;
    if (!isHeroTrackActive) {
      play(heroTrack);
      return;
    }
    const upperBound = effectiveDuration > 0 ? effectiveDuration : playerCurrentTime;
    const nextTime = Math.max(0, Math.min(upperBound, playerCurrentTime + seconds));
    seek(nextTime);
  };

  const showPreviousSlide = () => {
    setActiveIndex(currentIndex =>
      currentIndex === 0 ? heroSlides.length - 1 : currentIndex - 1
    );
  };

  const showNextSlide = () => {
    setActiveIndex(currentIndex => (currentIndex + 1) % heroSlides.length);
  };

  const selectSlide = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <section className="netflix-hero">
      {activeSlide.image ? (
        <div className="netflix-hero-media" style={{ backgroundImage: `url(${activeSlide.image})` }} />
      ) : (
        <div className="netflix-hero-media netflix-hero-media-fallback" />
      )}

      <div className="netflix-hero-content">
        <div className="netflix-hero-copy">
          <div className="netflix-hero-slider-toolbar">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/85">
              <Sparkles className="h-3.5 w-3.5 text-[#e50914]" />
              Featured Mix
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/65">
              {safeActiveIndex + 1} / {heroSlides.length}
            </span>
          </div>

          <h1 className="netflix-hero-title">{activeSlide.title}</h1>
          <p className="netflix-hero-description line-clamp-2">{activeSlide.summary}</p>

          {!hasAudio && (
            <div className="mb-4 flex flex-wrap gap-3">
              <Link href={`/voice-select/${activeSlide.id}`} className="netflix-button netflix-button-primary">
                Start voice setup
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/library" className="netflix-button netflix-button-secondary">
                Explore library
              </Link>
            </div>
          )}

          {onDeleteArticle && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => onDeleteArticle(activeSlide.source)}
                disabled={deleting}
                className="netflix-button netflix-button-secondary border-red-500/35 text-white/90 hover:border-red-500/70 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Deleting..." : "Delete article"}
              </button>
            </div>
          )}

          {heroTrack && (
            <div className="netflix-hero-player mt-4">
              <div className="netflix-hero-player-head">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/70">
                  Listening Deck
                </div>
                <div className="text-xs text-white/55">{heroTrack.voiceName}</div>
              </div>

              <div className="netflix-hero-player-slider">
                <div className="netflix-hero-player-slider-rail" />
                <div
                  className="netflix-hero-player-slider-fill"
                  style={{ width: `${isHeroTrackActive ? progress : 0}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max={effectiveDuration > 0 ? effectiveDuration : 1}
                  step="0.1"
                  value={playerCurrentTime}
                  onChange={(event) => handleSeek(Number(event.target.value))}
                  className="netflix-hero-player-range"
                  aria-label="Seek playback"
                />
              </div>

              <div className="netflix-hero-player-controls">
                <button
                  type="button"
                  onClick={() => skipBy(-10)}
                  className="netflix-hero-player-control"
                  aria-label="Rewind 10 seconds"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryPlayback}
                  className="netflix-hero-player-main"
                  aria-label={isHeroTrackActive && isPlaying ? "Pause narration" : "Start narration"}
                >
                  {isBuffering && isHeroTrackActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isHeroTrackActive && isPlaying ? (
                    <Pause className="h-5 w-5" fill="white" />
                  ) : (
                    <Play className="h-5 w-5" fill="white" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => skipBy(10)}
                  className="netflix-hero-player-control"
                  aria-label="Forward 10 seconds"
                >
                  <SkipForward className="h-4 w-4" />
                </button>

                <div className="netflix-hero-player-time">
                  <span>{formatDuration(playerCurrentTime)}</span>
                  <span>/</span>
                  <span>{formatDuration(effectiveDuration)}</span>
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="netflix-hero-player-control"
                  aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={currentVolume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="netflix-hero-volume-range"
                  aria-label="Volume"
                />
              </div>
            </div>
          )}

          {heroSlides.length > 1 && (
            <div className="netflix-hero-selector mt-4">
              <div className="netflix-hero-selector-head">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={showPreviousSlide}
                    className="netflix-hero-nav-button"
                    aria-label="Previous story"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextSlide}
                    className="netflix-hero-nav-button"
                    aria-label="Next story"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="netflix-hero-thumbs">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => selectSlide(index)}
                    className={`netflix-hero-thumb ${index === safeActiveIndex ? "is-active" : ""}`}
                    aria-label={`Open ${slide.title}`}
                  >
                    <div className="netflix-hero-thumb-image-wrap">
                      {slide.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={slide.image} alt={slide.title} className="netflix-hero-thumb-image" loading="lazy" />
                      ) : (
                        <div className="netflix-hero-thumb-fallback" />
                      )}
                    </div>
                    <span className="netflix-hero-thumb-title line-clamp-1">{slide.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="netflix-hero-stage" aria-label="Cinematic article stage">
          <div className="netflix-hero-stage-stack">
            {heroSlides.map((slide, index) => (
              <article
                key={slide.id}
                className={`netflix-hero-stage-slide ${index === safeActiveIndex ? "is-active" : ""}`}
                aria-hidden={index !== safeActiveIndex}
              >
                {slide.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.image} alt={slide.title} className="netflix-hero-stage-image" loading="lazy" />
                ) : (
                  <div className="netflix-hero-stage-fallback" />
                )}
                <div className="netflix-hero-stage-overlay">
                  <span className="netflix-hero-stage-kicker">
                    {slide.audioFile ? "Ready to listen" : "Needs voice setup"}
                  </span>
                  <h3 className="netflix-hero-stage-title line-clamp-2">{slide.title}</h3>
                </div>
              </article>
            ))}
          </div>

          <div className={`netflix-hero-visualizer ${isVisualizerActive ? "is-active" : ""}`} aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => (
              <span key={`bar-${index}`} style={{ animationDelay: `${(index % 8) * 90}ms` }} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
