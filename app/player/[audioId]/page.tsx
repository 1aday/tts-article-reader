"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Play, Pause, Home, Library, Download, Volume2, VolumeX,
  SkipBack, SkipForward, RefreshCw, Trash2, ChevronDown, ChevronUp, Loader2, Keyboard, Sparkles, Settings2
} from "lucide-react";
import { VoiceSelector } from "@/components/voice-selector";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { AudioSettingsPanel } from "@/components/audio-settings-panel";
import { DEFAULT_GENERATION_AUDIO_SETTINGS } from "@/lib/audio-settings";
import { formatDuration } from "@/lib/audio-duration";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";
import { usePlayer } from "@/contexts/PlayerContext";

interface Article {
  id: number;
  title: string;
  wordCount: number;
  sourceType: string;
  createdAt: string;
  imageUrl?: string | null;
  generatedImageUrl?: string | null;
  imageGenerationStatus?: string | null;
  imageGenerationError?: string | null;
}

interface AudioFile {
  id: number;
  articleId: number;
  voiceId: string;
  voiceName: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  blobUrl: string;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const VOLUME_STORAGE_KEY = "tts-full-player-volume";
const PLAYBACK_RATE_STORAGE_KEY = "tts-full-player-playback-rate";
const LISTENING_PROGRESS_PREFIX = "tts-full-player-progress-";
const GENERATED_COVER_MEDIA_SESSION_SIZE = "768x1024";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getPlaybackUrl = (blobUrl?: string | null) => {
  if (!blobUrl) return null;

  const normalizedUrl = blobUrl.trim();
  if (!normalizedUrl) return null;

  if (normalizedUrl.startsWith("/api/audio/proxy?url=")) {
    return normalizedUrl;
  }

  return `/api/audio/proxy?url=${encodeURIComponent(normalizedUrl)}`;
};
const getListeningProgressStorageKey = (id: number) => `${LISTENING_PROGRESS_PREFIX}${id}`;
const getPreferredDuration = (metadataDuration: number, fallbackDuration: number) => {
  const safeMetadata = Number.isFinite(metadataDuration) && metadataDuration > 0 ? metadataDuration : 0;
  const safeFallback = Number.isFinite(fallbackDuration) && fallbackDuration > 0 ? fallbackDuration : 0;

  if (safeMetadata <= 0) return safeFallback;
  if (safeFallback <= 0) return safeMetadata;

  const ratio = safeMetadata / safeFallback;
  if (ratio < 0.75 || ratio > 1.25) {
    return safeFallback;
  }

  return safeMetadata;
};
const getSeekableEnd = (audio: HTMLAudioElement) => {
  if (!audio.seekable || audio.seekable.length === 0) return 0;
  const end = audio.seekable.end(audio.seekable.length - 1);
  return Number.isFinite(end) && end > 0 ? end : 0;
};
const resolveDuration = (
  audio: HTMLAudioElement,
  fallbackDuration: number,
  currentDuration = 0,
  currentTime = audio.currentTime,
) => {
  const preferred = getPreferredDuration(audio.duration, fallbackDuration);
  const seekableEnd = getSeekableEnd(audio);
  const safeCurrentDuration = Number.isFinite(currentDuration) && currentDuration > 0 ? currentDuration : 0;
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  return Math.max(preferred, seekableEnd, safeCurrentDuration, safeCurrentTime);
};

const persistListeningProgress = (id: number, time: number) => {
  if (typeof window === "undefined" || !Number.isFinite(time)) return;
  try {
    localStorage.setItem(getListeningProgressStorageKey(id), String(time));
  } catch {
    // Ignore localStorage write errors.
  }
};

const clearSavedListeningProgress = (id: number) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getListeningProgressStorageKey(id));
  } catch {
    // Ignore localStorage remove errors.
  }
};

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const {
    currentTrack: stickyTrack,
    isPlaying: stickyIsPlaying,
    currentTime: stickyCurrentTime,
    pause: pauseSticky,
  } = usePlayer();
  const audioId = parseInt(params.audioId as string);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<AudioFile | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [allAudioVersions, setAllAudioVersions] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showActionsCard, setShowActionsCard] = useState(false);

  // Regeneration panel state
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [stability, setStability] = useState(DEFAULT_GENERATION_AUDIO_SETTINGS.stability);
  const [similarityBoost, setSimilarityBoost] = useState(DEFAULT_GENERATION_AUDIO_SETTINGS.similarityBoost);
  const [style, setStyle] = useState(DEFAULT_GENERATION_AUDIO_SETTINGS.style);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState(DEFAULT_GENERATION_AUDIO_SETTINGS.useSpeakerBoost);
  const [enableScriptEnhancement, setEnableScriptEnhancement] = useState(DEFAULT_GENERATION_AUDIO_SETTINGS.enableScriptEnhancement);
  const [keepOldVersion, setKeepOldVersion] = useState(true);

  // Confirmation dialogs
  const [showDeleteAudioDialog, setShowDeleteAudioDialog] = useState(false);
  const [showDeleteArticleDialog, setShowDeleteArticleDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);

  const handleActionsCardToggle = () => {
    setShowActionsCard((prev) => {
      const next = !prev;
      if (!next) {
        setShowRegeneratePanel(false);
      }
      return next;
    });
  };

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const visualizerConnectedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastVolumeBeforeMuteRef = useRef(1);
  const lastSavedSecondRef = useRef(-1);
  const handoffTimeRef = useRef<number | null>(null);
  const handoffShouldAutoplayRef = useRef(false);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    try {
      const storedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
      const parsedVolume = storedVolume ? Number(storedVolume) : NaN;
      if (Number.isFinite(parsedVolume)) {
        const safeVolume = clamp(parsedVolume, 0, 1);
        setVolume(safeVolume);
        if (safeVolume > 0) {
          lastVolumeBeforeMuteRef.current = safeVolume;
        }
      }

      const storedRate = localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY);
      const parsedRate = storedRate ? Number(storedRate) : NaN;
      if (Number.isFinite(parsedRate)) {
        setPlaybackRate(clamp(parsedRate, 0.5, 2));
      }
    } catch {
      // Ignore localStorage access errors.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // Ignore localStorage write errors.
    }
  }, [volume]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(playbackRate));
    } catch {
      // Ignore localStorage write errors.
    }
  }, [playbackRate]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void loadAudio();
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore disconnect issues on teardown.
        }
      }
      if (analyzerRef.current) {
        try {
          analyzerRef.current.disconnect();
        } catch {
          // Ignore disconnect issues on teardown.
        }
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
      sourceNodeRef.current = null;
      visualizerConnectedRef.current = false;
      analyzerRef.current = null;
      audioContextRef.current = null;
    };
  }, [audioId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = clamp(playbackRate, 0.5, 2);
    }
  }, [playbackRate]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.setAttribute("playsinline", "true");
    audioRef.current.setAttribute("webkit-playsinline", "true");
  }, []);

  useEffect(() => {
    const navigatorWithAudioSession = navigator as Navigator & {
      audioSession?: { type?: string };
    };

    if (!navigatorWithAudioSession.audioSession) return;

    try {
      navigatorWithAudioSession.audioSession.type = "playback";
    } catch {
      // Ignore unsupported audio session behavior.
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audioId)) return;

    const persistCurrentProgress = () => {
      if (!Number.isFinite(audio.currentTime)) return;
      persistListeningProgress(audioId, audio.currentTime);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentProgress();
      }
    };

    window.addEventListener("pagehide", persistCurrentProgress);
    window.addEventListener("beforeunload", persistCurrentProgress);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", persistCurrentProgress);
      window.removeEventListener("beforeunload", persistCurrentProgress);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      persistCurrentProgress();
    };
  }, [audioId]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const mediaSession = navigator.mediaSession;
    const mediaActions: MediaSessionAction[] = [
      "play",
      "pause",
      "seekbackward",
      "seekforward",
      "seekto",
    ];

    const setActionHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported media actions.
      }
    };

    if (!audioData || !article) {
      mediaSession.metadata = null;
      mediaSession.playbackState = "none";
      mediaActions.forEach((action) => setActionHandler(action, null));
      return;
    }

    const artworkUrl = hasPersistentGeneratedImage(article.generatedImageUrl)
      ? article.generatedImageUrl
      : article.imageUrl;

    mediaSession.metadata = new MediaMetadata({
      title: article.title,
      artist: audioData.voiceName,
      album: "TTS Reader",
      artwork: artworkUrl
        ? [
            {
              src: artworkUrl,
              sizes: GENERATED_COVER_MEDIA_SESSION_SIZE,
            },
          ]
        : undefined,
    });

    setActionHandler("play", () => {
      const audio = audioRef.current;
      if (!audio) return;
      setIsBuffering(true);
      void audio.play().catch((error) => {
        console.error("MediaSession play error:", error);
        setIsBuffering(false);
      });
    });
    setActionHandler("pause", () => {
      audioRef.current?.pause();
    });
    setActionHandler("seekbackward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      const seekOffset = details.seekOffset ?? 10;
      const safeDuration = resolveDuration(audio, audioData?.duration || 0, duration);
      const upperBound = Math.max(safeDuration, audio.currentTime);
      const nextTime = clamp(audio.currentTime - seekOffset, 0, upperBound);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
      persistListeningProgress(audioId, nextTime);
    });
    setActionHandler("seekforward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      const seekOffset = details.seekOffset ?? 10;
      const safeDuration = resolveDuration(audio, audioData?.duration || 0, duration);
      const upperBound = Math.max(safeDuration, audio.currentTime + seekOffset);
      const nextTime = clamp(audio.currentTime + seekOffset, 0, upperBound);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
      persistListeningProgress(audioId, nextTime);
    });
    setActionHandler("seekto", (details) => {
      const audio = audioRef.current;
      if (!audio || typeof details.seekTime !== "number") return;
      const safeDuration = resolveDuration(audio, audioData?.duration || 0, duration);
      const upperBound = Math.max(safeDuration, details.seekTime);
      const nextTime = clamp(details.seekTime, 0, upperBound);
      if (typeof audio.fastSeek === "function" && details.fastSeek) {
        audio.fastSeek(nextTime);
      } else {
        audio.currentTime = nextTime;
      }
      setCurrentTime(nextTime);
      persistListeningProgress(audioId, nextTime);
    });

    return () => {
      mediaActions.forEach((action) => setActionHandler(action, null));
    };
  }, [article, audioData, audioId, duration]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const safeDuration = Math.max(duration, currentTime);
    if (!(safeDuration > 0) || !Number.isFinite(currentTime)) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        position: clamp(currentTime, 0, safeDuration),
        playbackRate: clamp(playbackRate, 0.5, 2),
      });
    } catch {
      // Ignore unsupported position state updates.
    }
  }, [currentTime, duration, playbackRate]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!playing) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    void setupVisualizer();
  }, [playing]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = clamp(volume, 0, 1);
    audioRef.current.muted = muted || volume === 0;
  }, [muted, volume]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!audioRef.current) return;
        if (audioRef.current.paused) {
          setIsBuffering(true);
          void audioRef.current.play().catch((error) => {
            console.error("Play error:", error);
            setIsBuffering(false);
            toast.error("Unable to play audio right now.");
          });
        } else {
          audioRef.current.pause();
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (!audioRef.current) return;
        const safeDuration = resolveDuration(audioRef.current, audioData?.duration || 0, duration);
        const upperBound = Math.max(safeDuration, audioRef.current.currentTime);
        const next = clamp(audioRef.current.currentTime - 10, 0, upperBound);
        audioRef.current.currentTime = next;
        setCurrentTime(next);
        return;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (!audioRef.current) return;
        const safeDuration = resolveDuration(audioRef.current, audioData?.duration || 0, duration);
        const upperBound = Math.max(safeDuration, audioRef.current.currentTime + 10);
        const next = clamp(audioRef.current.currentTime + 10, 0, upperBound);
        audioRef.current.currentTime = next;
        setCurrentTime(next);
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        if (muted || volume === 0) {
          const restored = lastVolumeBeforeMuteRef.current > 0 ? lastVolumeBeforeMuteRef.current : 0.7;
          setVolume(restored);
          setMuted(false);
        } else {
          lastVolumeBeforeMuteRef.current = volume;
          setMuted(true);
        }
        return;
      }

      if (event.key === "[" || event.key === "-") {
        event.preventDefault();
        const currentIndex = PLAYBACK_RATES.findIndex((rate) => rate === playbackRate);
        const nextIndex = Math.max(0, currentIndex - 1);
        setPlaybackRate(PLAYBACK_RATES[nextIndex]);
        return;
      }

      if (event.key === "]" || event.key === "=" || event.key === "+") {
        event.preventDefault();
        const currentIndex = PLAYBACK_RATES.findIndex((rate) => rate === playbackRate);
        const nextIndex = Math.min(PLAYBACK_RATES.length - 1, currentIndex + 1);
        setPlaybackRate(PLAYBACK_RATES[nextIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [audioData?.duration, duration, muted, playbackRate, volume]);

  const setupVisualizer = async () => {
    if (!audioRef.current || !canvasRef.current) return;

    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextConstructor();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (!analyzerRef.current) {
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = window.matchMedia("(max-width: 640px)").matches ? 256 : 512;
        analyzer.smoothingTimeConstant = 0.85;
        analyzer.minDecibels = -95;
        analyzer.maxDecibels = -10;
        analyzerRef.current = analyzer;
      }

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = audioContext.createMediaElementSource(audioRef.current);
      }

      if (!visualizerConnectedRef.current) {
        sourceNodeRef.current.connect(analyzerRef.current);
        analyzerRef.current.connect(audioContext.destination);
        visualizerConnectedRef.current = true;
      }

      drawVisualizer();
    } catch (error) {
      console.error("Visualizer setup error:", error);
    }
  };

  const drawVisualizer = () => {
    if (!analyzerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const waveformArray = new Uint8Array(bufferLength);
    let lastFrameTime = 0;
    const frameIntervalMs = 1000 / 30;

    const draw = (timestamp: number) => {
      if (!isPlayingRef.current || !audioRef.current || audioRef.current.paused) {
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(draw);
      if (timestamp - lastFrameTime < frameIntervalMs) return;
      lastFrameTime = timestamp;

      const nextWidth = canvas.clientWidth || 1;
      const nextHeight = canvas.clientHeight || 1;
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      analyzer.getByteFrequencyData(dataArray);
      analyzer.getByteTimeDomainData(waveformArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(255, 92, 104, 0.04)");
      gradient.addColorStop(0.5, "rgba(229, 9, 20, 0.06)");
      gradient.addColorStop(1, "rgba(12, 15, 25, 0.35)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const mirroredBarCount = window.matchMedia("(max-width: 640px)").matches ? 40 : 64;
      const sampleStep = Math.max(1, Math.floor(bufferLength / mirroredBarCount));
      const barGap = canvas.width / mirroredBarCount;
      const halfHeight = canvas.height / 2;

      for (let i = 0; i < mirroredBarCount; i++) {
        const value = dataArray[i * sampleStep] / 255;
        const barHeight = Math.max(2, value * (canvas.height * 0.38));
        const barWidth = Math.max(2, barGap - 2);
        const x = i * barGap + 1;

        const hueShift = 356 - (i / mirroredBarCount) * 20;
        ctx.fillStyle = `hsla(${hueShift}, 100%, 60%, 0.86)`;
        ctx.fillRect(x, halfHeight - barHeight - 1, barWidth, barHeight);
        ctx.fillRect(x, halfHeight + 1, barWidth, barHeight);
      }

      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let waveX = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = waveformArray[i] / 128 - 1;
        const y = halfHeight + normalized * (canvas.height * 0.14);
        if (i === 0) {
          ctx.moveTo(waveX, y);
        } else {
          ctx.lineTo(waveX, y);
        }
        waveX += sliceWidth;
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const averageLevel = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalizedAverage = averageLevel / 255;
      ctx.fillStyle = `rgba(229, 9, 20, ${0.12 + normalizedAverage * 0.22})`;
      ctx.fillRect(0, halfHeight - 2, canvas.width, 4);
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(draw);
  };

  const loadAudio = async () => {
    setLoading(true);
    try {
      if (!Number.isFinite(audioId)) {
        toast.error("Invalid audio ID");
        setAudioUrl(null);
        return;
      }

      const response = await fetch(`/api/audio/${audioId}`);

      if (!response.ok) {
        toast.error("Failed to load audio");
        setAudioUrl(null);
        return;
      }

      const data: AudioFile = await response.json();
      const playbackUrl = getPlaybackUrl(data.blobUrl);
      setAudioUrl(playbackUrl);
      setAudioData(data);
      setSelectedVoiceId(data.voiceId);
      setSelectedVoiceName(data.voiceName);
      setDuration(data.duration || 0);
      lastSavedSecondRef.current = -1;

      // Hand off from sticky player to this full player if we're opening the same track.
      if (stickyTrack?.id === data.id) {
        handoffTimeRef.current = stickyCurrentTime;
        handoffShouldAutoplayRef.current = stickyIsPlaying;
        pauseSticky();
      } else {
        handoffTimeRef.current = null;
        handoffShouldAutoplayRef.current = false;
      }

      const [articleRes, versionsRes] = await Promise.all([
        fetch(`/api/article/${data.articleId}`),
        fetch(`/api/audio/list/${data.articleId}`),
      ]);

      if (articleRes.ok) {
        const articleData: Article = await articleRes.json();
        setArticle(articleData);
      } else {
        setArticle(null);
      }

      if (versionsRes.ok) {
        const versions: AudioFile[] = await versionsRes.json();
        setAllAudioVersions(versions);
      } else {
        setAllAudioVersions([]);
      }
    } catch (error) {
      console.error("Load audio error:", error);
      toast.error("Failed to load audio");
      setAudioUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      setIsBuffering(true);
      try {
        await setupVisualizer();
        await audioRef.current.play();
      } catch (error) {
        console.error("Play error:", error);
        setIsBuffering(false);
        toast.error("Unable to play audio right now.");
      }
      return;
    }

    audioRef.current.pause();
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const nextTime = audioRef.current.currentTime;
      setCurrentTime(nextTime);
      const nextDuration = resolveDuration(
        audioRef.current,
        audioData?.duration || 0,
        duration,
        nextTime,
      );
      if (nextDuration > 0 && nextDuration - duration > 0.25) {
        setDuration(nextDuration);
      }

      const roundedSecond = Math.floor(nextTime);
      if (roundedSecond !== lastSavedSecondRef.current) {
        lastSavedSecondRef.current = roundedSecond;
        persistListeningProgress(audioId, nextTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const safeDuration = resolveDuration(audioRef.current, audioData?.duration || 0, duration);
      setDuration(safeDuration);
      const resumeUpperBound = safeDuration > 0 ? safeDuration : (audioData?.duration || 0);

      let didApplyHandoff = false;
      if (handoffTimeRef.current !== null && Number.isFinite(handoffTimeRef.current)) {
        const handoffTime = clamp(handoffTimeRef.current, 0, Math.max(0, resumeUpperBound || handoffTimeRef.current));
        audioRef.current.currentTime = handoffTime;
        setCurrentTime(handoffTime);
        lastSavedSecondRef.current = Math.floor(handoffTime);
        didApplyHandoff = true;
      }

      try {
        const saved = Number(localStorage.getItem(getListeningProgressStorageKey(audioId)));
        if (
          Number.isFinite(saved) &&
          saved > 1 &&
          saved < (resumeUpperBound > 2 ? resumeUpperBound - 2 : Number.POSITIVE_INFINITY) &&
          !didApplyHandoff
        ) {
          audioRef.current.currentTime = saved;
          setCurrentTime(saved);
          lastSavedSecondRef.current = Math.floor(saved);
        }
      } catch {
        // Ignore localStorage read errors.
      }

      const shouldAutoplayAfterHandoff = handoffShouldAutoplayRef.current;
      handoffTimeRef.current = null;
      handoffShouldAutoplayRef.current = false;

      if (shouldAutoplayAfterHandoff) {
        setIsBuffering(true);
        void audioRef.current.play().catch((error) => {
          console.error("Playback handoff error:", error);
          setIsBuffering(false);
        });
      }
    }
  };
  const handleDurationChange = () => {
    if (!audioRef.current) return;
    const nextDuration = resolveDuration(audioRef.current, audioData?.duration || 0, duration);
    if (nextDuration > 0 && nextDuration - duration > 0.25) {
      setDuration(nextDuration);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    clearSavedListeningProgress(audioId);
  };

  const formatTime = (time: number) => {
    return formatDuration(time);
  };

  const seekTo = (time: number) => {
    if (!audioRef.current) return;
    const safeDuration = resolveDuration(audioRef.current, audioData?.duration || 0, duration, time);
    const nextTime = clamp(time, 0, Math.max(safeDuration, time));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    lastSavedSecondRef.current = Math.floor(nextTime);
    persistListeningProgress(audioId, nextTime);
  };

  const handleSeek = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) return;
    seekTo(parsed);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = clamp(parseFloat(e.target.value), 0, 1);
    setVolume(vol);
    if (vol > 0) {
      lastVolumeBeforeMuteRef.current = vol;
      setMuted(false);
    } else {
      setMuted(true);
    }
  };

  const toggleMute = () => {
    if (muted || volume === 0) {
      const restored = lastVolumeBeforeMuteRef.current > 0 ? lastVolumeBeforeMuteRef.current : 0.7;
      setVolume(restored);
      setMuted(false);
      return;
    }

    lastVolumeBeforeMuteRef.current = volume;
    setMuted(true);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const safeDuration = resolveDuration(audioRef.current, audioData?.duration || 0, duration, current);
    const upperBound = Number.isFinite(safeDuration) && safeDuration > 0
      ? Math.max(safeDuration, current + Math.max(seconds, 0))
      : current + Math.max(seconds, 0);
    const nextTime = clamp(current + seconds, 0, upperBound);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    lastSavedSecondRef.current = Math.floor(nextTime);
    persistListeningProgress(audioId, nextTime);
  };

  const handleDownload = async () => {
    try {
      const url = `/api/audio/${audioId}/download`;
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Full audio download started.");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download audio");
    }
  };

  const handleRegenerateImage = async () => {
    if (!article?.id) return;

    setRegeneratingImage(true);
    setArticle((prev) => (prev ? { ...prev, imageGenerationStatus: "generating", imageGenerationError: null } : prev));

    try {
      const response = await fetch("/api/article/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          regenerate: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate cover image");
      }

      const refreshedArticleResponse = await fetch(`/api/article/${article.id}`);
      if (refreshedArticleResponse.ok) {
        const refreshedArticle: Article = await refreshedArticleResponse.json();
        setArticle(refreshedArticle);
      } else {
        setArticle((prev) => (
          prev
            ? {
                ...prev,
                generatedImageUrl: data.imageUrl || prev.generatedImageUrl || null,
                imageGenerationStatus: "completed",
                imageGenerationError: null,
              }
            : prev
        ));
      }

      toast.success("Cover image regenerated");
    } catch (error) {
      console.error("Regenerate image error:", error);
      setArticle((prev) => (prev ? { ...prev, imageGenerationStatus: "failed" } : prev));
      toast.error(error instanceof Error ? error.message : "Failed to regenerate cover image");
    } finally {
      setRegeneratingImage(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedVoiceId) {
      toast.error("Please select a voice");
      return;
    }

    if (!article) return;

    setRegenerating(true);

    try {
      // Step 1: Prepare regeneration (optionally delete old)
      const regenerateRes = await fetch(`/api/audio/${audioId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: selectedVoiceId,
          deleteOld: !keepOldVersion,
          stability,
          similarityBoost,
          style,
          useSpeakerBoost,
        }),
      });

      if (!regenerateRes.ok) {
        throw new Error("Failed to prepare regeneration");
      }

      // Step 2: Redirect to generation page
      const generationParams = new URLSearchParams({
        voiceId: selectedVoiceId,
        skipEnhancement: (!enableScriptEnhancement).toString(),
        stability: stability.toString(),
        similarityBoost: similarityBoost.toString(),
        style: style.toString(),
        useSpeakerBoost: useSpeakerBoost.toString(),
      });
      if (selectedVoiceName.trim()) {
        generationParams.set("voiceName", selectedVoiceName.trim());
      }
      router.push(`/generate/${article.id}?${generationParams.toString()}`);
      toast.success("Regenerating audio...");
    } catch (error) {
      console.error("Regeneration error:", error);
      toast.error("Failed to regenerate audio");
    } finally {
      setRegenerating(false);
    }
  };

  const handleDeleteAudio = async () => {
    setDeleting(true);

    try {
      const response = await fetch(`/api/audio/${audioId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete audio");
      }

      clearSavedListeningProgress(audioId);

      toast.success("Audio deleted");

      // Redirect to another version or library
      if (allAudioVersions.length > 1) {
        const otherVersion = allAudioVersions.find((a) => a.id !== audioId);
        if (otherVersion) {
          router.push(`/player/${otherVersion.id}`);
        } else {
          router.push("/library");
        }
      } else {
        router.push("/library");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete audio");
    } finally {
      setDeleting(false);
      setShowDeleteAudioDialog(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!article) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/article/${article.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      toast.success("Article and all audio deleted");
      router.push("/library");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete article");
    } finally {
      setDeleting(false);
      setShowDeleteArticleDialog(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const effectiveDuration = Math.max(duration, currentTime);
  const progressPercentage = effectiveDuration > 0 ? clamp((currentTime / effectiveDuration) * 100, 0, 100) : 0;
  const remainingTime = Math.max(0, effectiveDuration - currentTime);
  const articleCoverImage = hasPersistentGeneratedImage(article?.generatedImageUrl)
    ? article?.generatedImageUrl || null
    : article?.imageUrl || null;
  const articleTitle = article?.title?.trim() || "Untitled Article";
  const articleSourceType = article?.sourceType
    ? `${article.sourceType.charAt(0).toUpperCase()}${article.sourceType.slice(1)}`
    : "Article";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.15),transparent_70%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 text-xl text-gray-400">
            <div className="w-6 h-6 border-2 border-[#e50914]/30 border-t-[#e50914] rounded-full animate-spin" />
            Loading audio...
          </div>
        </div>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="min-h-screen bg-[#141414] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.15),transparent_70%)]" />
        <div className="relative">
          <div className="bg-black/40 backdrop-blur-sm border border-gray-900 rounded-3xl p-12">
            <div className="text-center space-y-6">
              <div className="text-2xl text-gray-400">Audio not found</div>
              <Button
                onClick={() => router.push("/")}
                className="netflix-button netflix-button-primary h-12 px-8 rounded-2xl font-semibold"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#141414] pb-28 pt-20 sm:pb-32">
      {/* Netflix Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(229,9,20,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#141414] to-[#000000]" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#e50914] rounded-full opacity-20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 20}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8 xl:px-10">
        <div className="space-y-6 sm:space-y-8">
          <section className="seamless-panel relative overflow-hidden rounded-[32px] sm:rounded-[40px]">
            {articleCoverImage ? (
              <div
                className="absolute inset-0 opacity-45 bg-cover bg-center scale-110 blur-[3px]"
                style={{ backgroundImage: `url(${articleCoverImage})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(229,9,20,0.35),transparent_45%),linear-gradient(165deg,#0e1118,#1b2130)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/84 via-black/72 to-black/88" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(229,9,20,0.3),transparent_45%)]" />

            <div className="relative px-4 pb-6 pt-4 sm:px-7 sm:pb-8 sm:pt-7 lg:px-9">
              <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
                <div className="seamless-media-frame relative mx-auto aspect-[3/4] w-full max-w-[20rem] overflow-hidden rounded-[30px] sm:max-w-[24rem] lg:mx-0 lg:max-w-[36rem] xl:max-w-[40rem]">
                  {articleCoverImage ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${articleCoverImage})` }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(229,9,20,0.38),transparent_48%),linear-gradient(145deg,#0f1218,#1d2533)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                  <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#e50914]/10 border border-[#e50914]/30 px-3 py-1.5 backdrop-blur-md">
                      <div className={`w-2 h-2 rounded-full ${isBuffering ? "bg-amber-400 animate-pulse" : "bg-[#e50914] animate-pulse"}`} />
                      <span className="text-xs font-semibold tracking-[0.08em] text-[#ff4c54] uppercase">
                        {isBuffering ? "Buffering" : playing ? "Now Playing" : "Ready"}
                      </span>
                    </div>
                    {allAudioVersions.length > 1 && (
                      <div className="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-xs text-white/80 backdrop-blur-md">
                        {allAudioVersions.length} versions
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5 pt-1 lg:pb-2">
                  <div className="space-y-2">
                    <p className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-white/58">
                      {audioData?.voiceName || "Voice narration"}
                    </p>
                    <h1 className="font-display text-3xl leading-[1.02] text-white tracking-[0.02em] sm:text-5xl lg:text-6xl">
                      {articleTitle}
                    </h1>
                  </div>

                  <div className="space-y-4 rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_75%_35%,rgba(229,9,20,0.14),transparent_52%),linear-gradient(160deg,rgba(10,12,18,0.68),rgba(8,10,16,0.44))] px-4 py-4 shadow-[0_24px_56px_rgba(0,0,0,0.34)] sm:px-5 sm:py-5">
                    <div className="relative h-24 overflow-hidden rounded-2xl sm:h-28">
                      <div
                        className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(229,9,20,0.22),transparent_62%)] transition-opacity duration-300 ${
                          playing ? "opacity-100" : "opacity-65"
                        }`}
                      />
                      <canvas
                        ref={canvasRef}
                        width={800}
                        height={200}
                        className="absolute inset-0 h-full w-full"
                      />
                      {!playing && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] text-white/45">
                            {isBuffering ? "Buffering audio..." : "Visualizer appears while playing"}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 sm:space-y-5">
                      <div className="flex items-center justify-center gap-4 sm:gap-6">
                        <button
                          onClick={() => skip(-10)}
                          className="group flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:border-[#e50914]/30 hover:bg-white/10 sm:h-12 sm:w-12"
                          aria-label="Rewind 10 seconds"
                        >
                          <SkipBack className="h-5 w-5 text-white/70 transition-colors group-hover:text-[#e50914]" />
                        </button>

                        <button
                          onClick={togglePlay}
                          className="relative group h-16 w-16 rounded-full bg-[#e50914] shadow-2xl shadow-[#e50914]/35 transition-all hover:scale-105 hover:bg-[#f40612] hover:shadow-[#e50914]/55 sm:h-20 sm:w-20 md:h-24 md:w-24"
                          aria-label={playing ? "Pause audio" : "Play audio"}
                        >
                          <div className={`pointer-events-none absolute -inset-2 rounded-full border border-dashed border-[#ff4c54]/55 ${playing ? "animate-orbit" : "opacity-35"}`} />
                          <div className={`pointer-events-none absolute -inset-4 rounded-full border border-dashed border-[#e50914]/28 ${playing ? "animate-orbit-reverse" : "opacity-20"}`} />
                          <div className="absolute inset-0 rounded-full bg-[#e50914] blur-2xl opacity-50 transition-opacity group-hover:opacity-75" />
                          <div className="relative flex h-full w-full items-center justify-center">
                            {isBuffering ? (
                              <Loader2 className="h-8 w-8 animate-spin text-white sm:h-10 sm:w-10" />
                            ) : playing ? (
                              <Pause className="h-8 w-8 text-white sm:h-10 sm:w-10 md:h-12 md:w-12" fill="white" />
                            ) : (
                              <Play className="ml-0.5 h-8 w-8 text-white sm:ml-1 sm:h-10 sm:w-10 md:h-12 md:w-12" fill="white" />
                            )}
                          </div>
                        </button>

                        <button
                          onClick={() => skip(10)}
                          className="group flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:border-[#e50914]/30 hover:bg-white/10 sm:h-12 sm:w-12"
                          aria-label="Forward 10 seconds"
                        >
                          <SkipForward className="h-5 w-5 text-white/70 transition-colors group-hover:text-[#e50914]" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="group relative">
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="relative h-full rounded-full bg-[#e50914] transition-all"
                              style={{ width: `${progressPercentage}%` }}
                            >
                              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                            </div>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={effectiveDuration || 0}
                            step="0.1"
                            value={currentTime}
                            onInput={(event) => handleSeek(event.currentTarget.value)}
                            onChange={(event) => handleSeek(event.currentTarget.value)}
                            className="absolute inset-x-0 -top-3 h-8 w-full cursor-pointer appearance-none bg-transparent touch-pan-x [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#e50914] [&::-webkit-slider-thumb]:bg-white"
                            aria-label="Seek audio timeline"
                          />
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="whitespace-nowrap rounded-lg border border-[#e50914]/30 bg-black/90 px-3 py-1 text-xs text-white">
                              {formatTime(currentTime)}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between font-mono text-xs text-white/60 sm:text-sm">
                          <span>{formatTime(currentTime)}</span>
                          <span>-{formatTime(remainingTime)}</span>
                          <span>{formatTime(effectiveDuration)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 sm:gap-3">
                        <button
                          onClick={toggleMute}
                          className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:border-[#e50914]/30 hover:bg-white/10"
                          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                        >
                          {muted || volume === 0 ? (
                            <VolumeX className="h-4 w-4 text-white/70 transition-colors group-hover:text-[#e50914]" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-white/70 transition-colors group-hover:text-[#e50914]" />
                          )}
                        </button>

                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-[#e50914]"
                            style={{ width: `${muted ? 0 : volume * 100}%` }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={muted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label="Volume"
                          />
                        </div>

                        <span className="w-8 shrink-0 text-right font-mono text-[10px] text-white/55 sm:w-10 sm:text-[11px]">
                          {Math.round((muted ? 0 : volume) * 100)}%
                        </span>

                        <select
                          value={playbackRate}
                          onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                          aria-label="Playback speed"
                          className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] text-white/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                        >
                          {PLAYBACK_RATES.map((speed) => (
                            <option key={speed} value={speed}>
                              {speed}x
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-white/80">
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                      {article?.wordCount ? `${article.wordCount.toLocaleString()} words` : "Article"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                      {articleSourceType}
                    </span>
                    {article?.createdAt && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                        {formatDate(article.createdAt)}
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                      {formatTime(effectiveDuration)}
                    </span>
                    {audioData?.fileSize && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                        {formatFileSize(audioData.fileSize)}
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                      {playbackRate}x
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                      {regeneratingImage || article?.imageGenerationStatus === "generating"
                        ? "AI cover generating"
                        : hasPersistentGeneratedImage(article?.generatedImageUrl)
                          ? "AI cover ready"
                          : "Source cover"}
                    </span>
                  </div>

                  <div>
                    <button
                      onClick={() => setShowKeyboardHelp((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      Keyboard Shortcuts
                    </button>
                    {showKeyboardHelp && (
                      <div className="seamless-subpanel mt-3 max-w-xl rounded-xl px-4 py-3 text-left text-xs text-white/70">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <span><kbd className="text-white">Space / K</kbd> Play/Pause</span>
                          <span><kbd className="text-white">J / L</kbd> -10s / +10s</span>
                          <span><kbd className="text-white">Left / Right</kbd> Seek</span>
                          <span><kbd className="text-white">M</kbd> Mute/Unmute</span>
                          <span><kbd className="text-white">[ / ]</kbd> Speed down/up</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={handleDurationChange}
            onEnded={handleEnded}
            onPlay={() => {
              setPlaying(true);
              void setupVisualizer();
            }}
            onPause={() => {
              setPlaying(false);
              if (audioRef.current && Number.isFinite(audioRef.current.currentTime)) {
                persistListeningProgress(audioId, audioRef.current.currentTime);
              }
            }}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onPlaying={() => setIsBuffering(false)}
            onError={(e) => {
              console.error("Audio playback error:", e);
              setIsBuffering(false);
              setPlaying(false);
              toast.error("Failed to load audio. Please try downloading instead.");
            }}
            crossOrigin="anonymous"
            preload="metadata"
          />

          <section className="relative space-y-6">
            {!showActionsCard ? (
              <div className="seamless-panel animate-action-card-flip rounded-[32px] p-4 sm:p-6 md:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Compact Controls
                    </p>
                    <h2 className="text-xl font-semibold text-white sm:text-2xl">
                      Audio actions are hidden
                    </h2>
                    <p className="max-w-md text-sm text-white/65">
                      Click the gear icon to flip this card and open regenerate, download, library, and delete actions.
                    </p>
                  </div>
                  <button
                    onClick={handleActionsCardToggle}
                    className="group flex h-12 w-12 items-center justify-center rounded-xl border border-[#e50914]/30 bg-[#e50914]/15 transition-all hover:bg-[#e50914]/22"
                    aria-label="Open action controls"
                    title="Open action controls"
                  >
                    <Settings2 className="h-5 w-5 text-[#ff4c54] transition-transform duration-300 group-hover:rotate-90" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="seamless-panel animate-action-card-flip space-y-6 rounded-[32px] p-4 sm:p-6 md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Audio Actions
                    </p>
                    <h2 className="text-xl font-semibold text-white sm:text-2xl">
                      Manage this audio card
                    </h2>
                  </div>
                  <button
                    onClick={handleActionsCardToggle}
                    className="group flex h-12 w-12 items-center justify-center rounded-xl border border-[#e50914]/30 bg-[#e50914]/15 transition-all hover:bg-[#e50914]/22"
                    aria-label="Close action controls"
                    title="Close action controls"
                  >
                    <Settings2 className="h-5 w-5 text-[#ff4c54] transition-transform duration-300 group-hover:-rotate-90" />
                  </button>
                </div>

                {/* Regeneration Panel */}
                <div>
                  <button
                    onClick={() => setShowRegeneratePanel(!showRegeneratePanel)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-[#e50914]/15 bg-[#e50914]/[0.07] p-4 transition-all hover:bg-[#e50914]/[0.12]"
                  >
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-[#e50914]" />
                      <span className="font-semibold text-white">Regenerate Audio</span>
                    </div>
                    {showRegeneratePanel ? (
                      <ChevronUp className="h-5 w-5 text-white/50 transition-colors group-hover:text-[#e50914]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white/50 transition-colors group-hover:text-[#e50914]" />
                    )}
                  </button>

                  {showRegeneratePanel && (
                    <div className="seamless-subpanel mt-6 space-y-6 rounded-2xl p-6 animate-fadeIn">
                      <VoiceSelector
                        selectedVoiceId={selectedVoiceId}
                        onVoiceSelect={(voiceId, voiceName) => {
                          setSelectedVoiceId(voiceId);
                          setSelectedVoiceName(voiceName);
                        }}
                        placeholder="Select a voice..."
                      />

                      <AudioSettingsPanel
                        stability={stability}
                        onStabilityChange={setStability}
                        similarityBoost={similarityBoost}
                        onSimilarityBoostChange={setSimilarityBoost}
                        style={style}
                        onStyleChange={setStyle}
                        useSpeakerBoost={useSpeakerBoost}
                        onUseSpeakerBoostChange={setUseSpeakerBoost}
                        enableScriptEnhancement={enableScriptEnhancement}
                        onEnableScriptEnhancementChange={setEnableScriptEnhancement}
                      />

                      <div className="seamless-subpanel flex items-center gap-3 rounded-xl p-4">
                        <input
                          type="checkbox"
                          id="keepOldVersion"
                          checked={keepOldVersion}
                          onChange={(e) => setKeepOldVersion(e.target.checked)}
                          className="h-5 w-5 rounded border-white/20 bg-white/5"
                        />
                        <label htmlFor="keepOldVersion" className="text-sm text-white">
                          Keep current version (create new audio file)
                        </label>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowRegeneratePanel(false)}
                          className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleRegenerate}
                          loading={regenerating}
                          disabled={regenerating || !selectedVoiceId}
                          className="flex-1 netflix-button netflix-button-primary"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Generate New Audio
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <Button
                    onClick={handleRegenerateImage}
                    loading={regeneratingImage}
                    disabled={regeneratingImage || !article}
                    className="netflix-button netflix-button-secondary h-12 rounded-xl font-semibold sm:h-14"
                  >
                    {!regeneratingImage && <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                    {regeneratingImage ? "Regenerating..." : "Regenerate Cover"}
                  </Button>

                  <Button
                    onClick={handleDownload}
                    className="netflix-button netflix-button-primary h-12 rounded-xl text-sm font-bold sm:h-14 sm:text-base"
                  >
                    <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Download
                  </Button>

                  <Button
                    onClick={() => router.push("/library")}
                    className="netflix-button netflix-button-secondary h-12 rounded-xl font-semibold sm:h-14"
                  >
                    <Library className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Library
                  </Button>
                </div>

                {/* Danger Zone */}
                <div className="soft-divider pt-6">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={() => setShowDeleteAudioDialog(true)}
                      variant="danger"
                      className="flex-1 h-11"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete This Audio
                    </Button>
                    <Button
                      onClick={() => setShowDeleteArticleDialog(true)}
                      variant="danger"
                      className="flex-1 h-11"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Article & All Audio
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {allAudioVersions.length > 1 && (
              <div className="seamless-panel rounded-[32px] p-4 sm:p-6 md:p-7">
                <h3 className="mb-4 text-lg font-semibold text-white">
                  Other Audio Versions ({allAudioVersions.length - 1})
                </h3>
                <div className="space-y-2">
                  {allAudioVersions
                    .filter((v) => v.id !== audioId)
                    .map((version) => (
                      <button
                        key={version.id}
                        onClick={() => router.push(`/player/${version.id}`)}
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] p-4 text-left transition-all hover:border-[#e50914]/25 hover:bg-white/[0.08]"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white">{version.voiceName}</div>
                            <div className="mt-1 text-xs text-white/50">
                              {formatTime(version.duration)} • {formatFileSize(version.fileSize)} • {formatDate(version.createdAt)}
                            </div>
                          </div>
                          <Play className="h-5 w-5 text-[#e50914]" />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showDeleteAudioDialog}
        onClose={() => setShowDeleteAudioDialog(false)}
        onConfirm={handleDeleteAudio}
        title="Delete Audio"
        message="Are you sure you want to delete this audio file? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

      <ConfirmationDialog
        isOpen={showDeleteArticleDialog}
        onClose={() => setShowDeleteArticleDialog(false)}
        onConfirm={handleDeleteArticle}
        title="Delete Article"
        message={`This will permanently delete the article "${article?.title}" and all ${allAudioVersions.length} audio file(s). This action cannot be undone.`}
        confirmText="Delete Everything"
        variant="danger"
        loading={deleting}
      />

      <style jsx>{`
        .seamless-panel {
          position: relative;
          isolation: isolate;
          background:
            linear-gradient(145deg, rgba(10, 12, 18, 0.82) 0%, rgba(9, 12, 18, 0.66) 42%, rgba(20, 9, 12, 0.62) 100%),
            radial-gradient(circle at 85% 12%, rgba(229, 9, 20, 0.16), transparent 42%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow:
            0 30px 85px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(22px);
        }

        .seamless-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            radial-gradient(ellipse at top left, rgba(255, 255, 255, 0.13), transparent 54%),
            radial-gradient(ellipse at 20% 88%, rgba(52, 96, 255, 0.08), transparent 50%);
          mix-blend-mode: screen;
          opacity: 0.55;
        }

        .seamless-panel::after {
          content: "";
          position: absolute;
          inset: -32px;
          z-index: -1;
          border-radius: inherit;
          pointer-events: none;
          background:
            radial-gradient(circle at 80% 16%, rgba(229, 9, 20, 0.2), transparent 56%),
            radial-gradient(circle at 14% 84%, rgba(57, 114, 255, 0.13), transparent 54%);
          filter: blur(20px);
          opacity: 0.75;
        }

        .seamless-subpanel {
          position: relative;
          background:
            linear-gradient(160deg, rgba(14, 16, 24, 0.72) 0%, rgba(8, 10, 16, 0.56) 100%);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 16px 42px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(14px);
        }

        .seamless-media-frame {
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.1),
            0 28px 60px rgba(0, 0, 0, 0.5);
          background-color: rgba(0, 0, 0, 0.45);
        }

        .soft-divider {
          position: relative;
        }

        .soft-divider::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(229, 9, 20, 0.46) 22%,
            rgba(255, 255, 255, 0.2) 50%,
            rgba(229, 9, 20, 0.26) 78%,
            transparent 100%
          );
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
        .animate-float {
          animation: float linear infinite;
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes actionCardFlip {
          from {
            opacity: 0;
            transform: perspective(1200px) rotateY(-72deg) translateX(10px);
            transform-origin: right center;
          }
          to {
            opacity: 1;
            transform: perspective(1200px) rotateY(0deg) translateX(0);
            transform-origin: right center;
          }
        }
        .animate-action-card-flip {
          animation: actionCardFlip 0.45s cubic-bezier(0.22, 1, 0.36, 1);
          backface-visibility: hidden;
        }
        @keyframes orbit {
          0% {
            transform: rotate(0deg) scale(1);
          }
          100% {
            transform: rotate(360deg) scale(1);
          }
        }
        @keyframes orbitReverse {
          0% {
            transform: rotate(360deg) scale(1);
          }
          100% {
            transform: rotate(0deg) scale(1);
          }
        }
        .animate-orbit {
          animation: orbit 9s linear infinite;
        }
        .animate-orbit-reverse {
          animation: orbitReverse 13s linear infinite;
        }
      `}</style>
    </div>
  );
}
