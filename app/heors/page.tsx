"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/lib/audio-duration";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import styles from "./page.module.css";

type HeroIdea = {
  id: string;
  title: string;
  line: string;
  note: string;
  layout: "left" | "right" | "center";
};

type LibraryAudio = {
  id: number;
  voiceName: string;
  blobUrl: string | null;
  duration: number | null;
};

type LibraryArticle = {
  id: number;
  title: string;
  wordCount: number;
  imageUrl: string | null;
  generatedImageUrl: string | null;
  audioFiles?: LibraryAudio[];
};

type LibraryResponse = {
  success: boolean;
  articles?: LibraryArticle[];
};

type PlayerTrack = {
  id: number;
  articleId: number;
  articleTitle: string;
  articleImageUrl: string | null;
  voiceName: string;
  blobUrl: string;
  duration: number;
};

type Slide = HeroIdea & {
  image: string | null;
  sourceTitle: string;
  thumbTitle: string;
  playerTrack: PlayerTrack | null;
};

const HERO_IDEAS: HeroIdea[] = [
  { id: "01", title: "Cinematic Spotlight", line: "One featured story, one dominant play action.", note: "For instant start behavior.", layout: "left" },
  { id: "02", title: "Waveform Atlas", line: "Sound-first discovery with category motion lanes.", note: "For browsing before commitment.", layout: "right" },
  { id: "03", title: "Editorial Fold", line: "Poster-like hierarchy with restrained controls.", note: "For premium reading tone.", layout: "left" },
  { id: "04", title: "Split Studio", line: "Input and output shown in one frame.", note: "For conversion confidence.", layout: "right" },
  { id: "05", title: "Orbital Voice Cast", line: "Voice identities orbit around a center narrator.", note: "For voice differentiation.", layout: "center" },
  { id: "06", title: "Editorial Ribbon", line: "Story strip under a locked hero headline.", note: "For news cadence.", layout: "left" },
  { id: "07", title: "Signal Grid", line: "Preset controls elevated into hero UI.", note: "For power users.", layout: "right" },
  { id: "08", title: "Quiet Minimal", line: "Whitespace-forward with low-friction playback.", note: "For focus sessions.", layout: "center" },
  { id: "09", title: "Neural Timeline", line: "Chapter milestones as the primary interaction.", note: "For selective listeners.", layout: "left" },
  { id: "10", title: "Aurora Feed", line: "Freshness encoded through atmosphere and glow.", note: "For recency-driven content.", layout: "right" },
  { id: "11", title: "Bento Command", line: "Queue, progress, and actions in one viewport.", note: "For returning users.", layout: "center" },
  { id: "12", title: "Terminal Pulse", line: "Brand command language with modern polish.", note: "For strong product identity.", layout: "left" },
  { id: "13", title: "Poster Layout", line: "Magazine cover framing with cinematic contrast.", note: "For premium storytelling.", layout: "right" },
  { id: "14", title: "Liquid Motion", line: "Morphing red energy around concise copy.", note: "For AI transformation narrative.", layout: "center" },
  { id: "15", title: "Stage Deck", line: "Layered capability reveal in depth.", note: "For launch pages.", layout: "left" },
  { id: "16", title: "Velocity Split", line: "Diagonal momentum guides eyes to CTA.", note: "For high-action campaigns.", layout: "right" },
  { id: "17", title: "Mosaic Immersion", line: "Cover collage with focused hover states.", note: "For breadth-first discovery.", layout: "center" },
  { id: "18", title: "Scheduler Hero", line: "Daily queue ritual framed in hero context.", note: "For retention loops.", layout: "left" },
  { id: "19", title: "Accessibility First", line: "Legibility and confidence as core design rule.", note: "For universal usability.", layout: "right" },
  { id: "20", title: "Future Console", line: "Roadmap-ready cinematic HUD concept.", note: "For north-star communication.", layout: "center" },
];

const AUTO_PLAY_MS = 6500;

const getArticleImage = (article: LibraryArticle): string | null => {
  if (hasPersistentGeneratedImage(article.generatedImageUrl)) {
    return article.generatedImageUrl;
  }

  return article.imageUrl;
};

const buildTrack = (
  article: LibraryArticle,
  imageUrl: string | null,
): PlayerTrack | null => {
  const audio = article.audioFiles?.find((candidate) => Boolean(candidate.blobUrl));

  if (!audio?.blobUrl) return null;

  const fallbackDuration = Math.max(30, Math.round((article.wordCount || 450) / 200) * 60);

  return {
    id: audio.id,
    articleId: article.id,
    articleTitle: article.title,
    articleImageUrl: imageUrl,
    voiceName: audio.voiceName,
    blobUrl: audio.blobUrl,
    duration: Number.isFinite(audio.duration) && (audio.duration ?? 0) > 0
      ? (audio.duration as number)
      : fallbackDuration,
  };
};

export default function HeorsPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [libraryArticles, setLibraryArticles] = useState<LibraryArticle[]>([]);

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    play,
    pause,
    resume,
    seek,
  } = usePlayer();

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      try {
        const response = await fetch("/api/library");
        const data = (await response.json()) as LibraryResponse;

        if (!response.ok || !data.success || !Array.isArray(data.articles)) {
          return;
        }

        if (!cancelled) {
          setLibraryArticles(data.articles);
        }
      } catch (error) {
        console.error("[heors] Failed to load library", error);
      }
    }

    loadLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoPlay) return;

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_IDEAS.length);
    }, AUTO_PLAY_MS);

    return () => clearInterval(timer);
  }, [autoPlay]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % HERO_IDEAS.length);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + HERO_IDEAS.length) % HERO_IDEAS.length);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const slides = useMemo<Slide[]>(() => {
    const enriched = libraryArticles.map((article) => {
      const image = getArticleImage(article);
      const track = buildTrack(article, image);
      return { article, image, track };
    });

    const imagePool = enriched.filter((entry) => Boolean(entry.image));
    const audioPool = enriched.filter((entry) => Boolean(entry.track));

    return HERO_IDEAS.map((idea, index) => {
      const visualSource = imagePool.length > 0 ? imagePool[index % imagePool.length] : null;
      const audioSource = audioPool.length > 0
        ? audioPool[index % audioPool.length]
        : visualSource;

      return {
        ...idea,
        image: visualSource?.image ?? null,
        sourceTitle: visualSource?.article.title ?? "Library article",
        thumbTitle: visualSource?.article.title ?? idea.title,
        playerTrack: audioSource?.track ?? null,
      };
    });
  }, [libraryArticles]);

  const imageCount = useMemo(
    () => libraryArticles.map(getArticleImage).filter((image): image is string => Boolean(image)).length,
    [libraryArticles],
  );

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  const goPrev = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const handlePrimaryPlayback = (track: PlayerTrack | null) => {
    if (!track) return;

    const isTrackActive = currentTrack?.id === track.id;

    if (isTrackActive) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }

    play(track);
  };

  const handleSeek = (track: PlayerTrack | null, time: number) => {
    if (!track) return;

    const isTrackActive = currentTrack?.id === track.id;
    const next = Math.max(0, Math.min(track.duration, time));

    if (!isTrackActive) {
      play(track);
      seek(next);
      return;
    }

    seek(next);
  };

  const skipBy = (track: PlayerTrack | null, deltaSeconds: number) => {
    if (!track) return;

    const isTrackActive = currentTrack?.id === track.id;

    if (!isTrackActive) {
      play(track);
      return;
    }

    const upperBound = duration > 0 ? duration : track.duration;
    const next = Math.max(0, Math.min(upperBound, currentTime + deltaSeconds));
    seek(next);
  };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <p className={styles.kicker}>
          <Sparkles size={14} aria-hidden="true" />
          Heors Slider · Cinematic Direction Set
        </p>
        <h1>
          20 On-Brand Hero Directions
          <span>All in one slider, with existing images and an in-slide player.</span>
        </h1>

        <div className={styles.headerActions}>
          <button type="button" onClick={() => setAutoPlay((current) => !current)}>
            {autoPlay ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            {autoPlay ? "Pause autoplay" : "Resume autoplay"}
          </button>
          <Link href="/create">Create audio</Link>
          <Link href="/library">Open library</Link>
        </div>
      </section>

      <section
        className={styles.slider}
        onMouseEnter={() => setAutoPlay(false)}
        onMouseLeave={() => setAutoPlay(true)}
      >
        <div className={styles.track} style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {slides.map((slide, index) => {
            const track = slide.playerTrack;
            const isTrackActive = Boolean(track && currentTrack?.id === track.id);
            const liveDuration = isTrackActive ? (duration > 0 ? duration : track?.duration ?? 0) : track?.duration ?? 0;
            const liveTime = isTrackActive ? currentTime : 0;
            const progress = liveDuration > 0 ? Math.min(100, Math.max(0, (liveTime / liveDuration) * 100)) : 0;
            const isPlayingThisTrack = isTrackActive && isPlaying;

            return (
              <article
                key={slide.id}
                className={`${styles.slide} ${styles[`slide${slide.id}`]} ${styles[`align${slide.layout}`]}`}
                aria-hidden={index !== activeIndex}
              >
                <div
                  className={styles.media}
                  style={
                    slide.image
                      ? {
                          backgroundImage: `url(${slide.image})`,
                        }
                      : undefined
                  }
                />

                <div className={styles.overlay} />
                <div className={styles.filmGrain} />

                <div className={styles.copy}>
                  <p>
                    Idea {slide.id} / 20
                    <span>{slide.note}</span>
                  </p>
                  <h2>{slide.title}</h2>
                  <h3>{slide.line}</h3>

                  <div className={styles.slideActions}>
                    <Link href="/create">Prototype</Link>
                    <Link href="/library">Use this direction</Link>
                  </div>

                  <div className={styles.player}>
                    <div className={styles.playerHead}>
                      <span>{track ? `Voice · ${track.voiceName}` : "No generated audio found"}</span>
                      <span>
                        {formatDuration(liveTime)} / {formatDuration(liveDuration)}
                      </span>
                    </div>

                    <div className={styles.playerProgressRail}>
                      <span className={styles.playerProgressFill} style={{ width: `${progress}%` }} />
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, liveDuration)}
                      step={0.1}
                      value={liveTime}
                      onChange={(event) => handleSeek(track, Number(event.target.value))}
                      className={styles.playerRange}
                      disabled={!track}
                    />

                    <div className={styles.playerControls}>
                      <button
                        type="button"
                        onClick={() => skipBy(track, -10)}
                        className={styles.playerButton}
                        disabled={!track}
                        aria-label="Back 10 seconds"
                      >
                        <SkipBack size={14} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrimaryPlayback(track)}
                        className={styles.playerMainButton}
                        disabled={!track}
                        aria-label={isPlayingThisTrack ? "Pause" : "Play"}
                      >
                        {isPlayingThisTrack ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                        {isBuffering && isTrackActive ? "Buffering" : isPlayingThisTrack ? "Pause" : "Play"}
                      </button>

                      <button
                        type="button"
                        onClick={() => skipBy(track, 15)}
                        className={styles.playerButton}
                        disabled={!track}
                        aria-label="Forward 15 seconds"
                      >
                        <SkipForward size={14} aria-hidden="true" />
                      </button>
                    </div>

                    <p className={styles.playerHint}>
                      {track ? `Source image: ${slide.sourceTitle}` : "Generate audio in Create to enable direct preview."}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button type="button" onClick={goPrev} className={styles.navPrev} aria-label="Previous slide">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={goNext} className={styles.navNext} aria-label="Next slide">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>

      <section className={styles.footerRow}>
        <div className={styles.dots}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to idea ${slide.id}`}
              className={index === activeIndex ? styles.dotActive : styles.dot}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>

        <div className={styles.thumbRail}>
          {slides.map((slide, index) => (
            <button
              key={`thumb-${slide.id}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={index === activeIndex ? styles.thumbActive : styles.thumb}
              aria-label={`Preview idea ${slide.id}`}
            >
              <span
                className={styles.thumbImage}
                style={slide.image ? { backgroundImage: `url(${slide.image})` } : undefined}
              />
              <span className={styles.thumbMeta}>
                <strong>Idea {slide.id}</strong>
                <span>{slide.thumbTitle}</span>
              </span>
            </button>
          ))}
        </div>

        <p className={styles.sourceNote}>
          {imageCount > 0
            ? `Using ${imageCount} existing library images across all 20 directions.`
            : "No library images found yet. Add images in your library and this slider will fill automatically."}
        </p>
      </section>
    </main>
  );
}
