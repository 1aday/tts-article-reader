'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

interface AudioFile {
  id: number;
  articleId: number;
  articleTitle: string;
  articleImageUrl?: string | null;
  voiceName: string;
  blobUrl: string;
  duration: number;
}

interface PlayerContextType {
  currentTrack: AudioFile | null;
  isStickyPlayerVisible: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  play: (track: AudioFile) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  closeStickyPlayer: () => void;
  showStickyPlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const VOLUME_STORAGE_KEY = "tts-player-volume";
const PLAYBACK_RATE_STORAGE_KEY = "tts-player-playback-rate";
const LISTENING_PROGRESS_PREFIX = "tts-player-progress-";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getInitialVolume = () => {
  if (typeof window === "undefined") return 1;
  try {
    const storedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
    const parsedVolume = storedVolume ? Number(storedVolume) : NaN;
    if (!Number.isFinite(parsedVolume)) return 1;
    return clamp(parsedVolume, 0, 1);
  } catch {
    return 1;
  }
};

const getInitialPlaybackRate = () => {
  if (typeof window === "undefined") return 1;
  try {
    const storedRate = localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY);
    const parsedRate = storedRate ? Number(storedRate) : NaN;
    if (!Number.isFinite(parsedRate)) return 1;
    return clamp(parsedRate, 0.5, 2);
  } catch {
    return 1;
  }
};

const getListeningProgressStorageKey = (trackId: number) =>
  `${LISTENING_PROGRESS_PREFIX}${trackId}`;

const persistListeningProgress = (trackId: number, time: number) => {
  if (typeof window === "undefined" || !Number.isFinite(time)) return;
  try {
    localStorage.setItem(getListeningProgressStorageKey(trackId), String(time));
  } catch {
    // Ignore localStorage write errors.
  }
};

const getSavedListeningProgress = (trackId: number) => {
  if (typeof window === "undefined") return null;
  try {
    const saved = Number(localStorage.getItem(getListeningProgressStorageKey(trackId)));
    return Number.isFinite(saved) ? saved : null;
  } catch {
    return null;
  }
};

const clearSavedListeningProgress = (trackId: number) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getListeningProgressStorageKey(trackId));
  } catch {
    // Ignore localStorage remove errors.
  }
};

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
  const [isStickyPlayerVisible, setIsStickyPlayerVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(getInitialVolume);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(getInitialPlaybackRate);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<AudioFile | null>(null);
  const lastVolumeBeforeMuteRef = useRef(volume > 0 ? volume : 1);
  const lastSavedSecondRef = useRef(-1);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // Ignore storage write failures.
    }
  }, [volume]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(playbackRate));
    } catch {
      // Ignore storage write failures.
    }
  }, [playbackRate]);

  useEffect(() => {
    // Create audio element
    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audioRef.current = audio;

    const persistCurrentTrackProgress = () => {
      const trackId = currentTrackRef.current?.id;
      if (!trackId || !Number.isFinite(audio.currentTime)) return;
      persistListeningProgress(trackId, audio.currentTime);
    };

    const handleTimeUpdate = () => {
      const nextTime = audio.currentTime;
      setCurrentTime(nextTime);

      const trackId = currentTrackRef.current?.id;
      if (!trackId || !Number.isFinite(nextTime)) return;

      const roundedSecond = Math.floor(nextTime);
      if (roundedSecond !== lastSavedSecondRef.current) {
        lastSavedSecondRef.current = roundedSecond;
        persistListeningProgress(trackId, nextTime);
      }
    };

    const handleLoadedMetadata = () => {
      const track = currentTrackRef.current;
      const safeDuration = Number.isFinite(audio.duration)
        ? audio.duration
        : (track?.duration || 0);

      setDuration(safeDuration);

      if (!track) return;

      const saved = getSavedListeningProgress(track.id);
      const upperBound = Math.max(1, safeDuration - 2);
      if (
        Number.isFinite(saved) &&
        saved !== null &&
        saved > 1 &&
        saved < upperBound
      ) {
        audio.currentTime = saved;
        setCurrentTime(saved);
      }
    };

    const handleEnded = () => {
      const trackId = currentTrackRef.current?.id;
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
      lastSavedSecondRef.current = -1;
      if (trackId) {
        clearSavedListeningProgress(trackId);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
      persistCurrentTrackProgress();
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      persistCurrentTrackProgress();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handleCanPlay);
    audio.addEventListener("error", handleError);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistCurrentTrackProgress();
      }
    };

    window.addEventListener("pagehide", persistCurrentTrackProgress);
    window.addEventListener("beforeunload", persistCurrentTrackProgress);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handleCanPlay);
      audio.removeEventListener("error", handleError);
      window.removeEventListener("pagehide", persistCurrentTrackProgress);
      window.removeEventListener("beforeunload", persistCurrentTrackProgress);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      persistCurrentTrackProgress();
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = clamp(volume, 0, 1);
      audioRef.current.muted = muted || volume === 0;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = clamp(playbackRate, 0.5, 2);
    }
  }, [playbackRate]);

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

    if (!currentTrack) {
      mediaSession.metadata = null;
      mediaSession.playbackState = "none";
      mediaActions.forEach((action) => setActionHandler(action, null));
      return;
    }

    mediaSession.metadata = new MediaMetadata({
      title: currentTrack.articleTitle,
      artist: currentTrack.voiceName,
      album: "TTS Reader",
      artwork: currentTrack.articleImageUrl
        ? [
            {
              src: currentTrack.articleImageUrl,
              sizes: "512x512",
            },
          ]
        : undefined,
    });
    mediaSession.playbackState = isPlaying ? "playing" : "paused";

    setActionHandler("play", () => {
      const audio = audioRef.current;
      if (!audio) return;
      void audio.play().catch((error) => {
        console.error("[Player] MediaSession play failed:", error);
      });
    });
    setActionHandler("pause", () => {
      audioRef.current?.pause();
    });
    setActionHandler("seekbackward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      const seekOffset = details.seekOffset ?? 10;
      const safeDuration = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime;
      const nextTime = clamp(audio.currentTime - seekOffset, 0, safeDuration);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    });
    setActionHandler("seekforward", (details) => {
      const audio = audioRef.current;
      if (!audio) return;
      const safeDuration = Number.isFinite(audio.duration) ? audio.duration : (duration || audio.currentTime);
      const seekOffset = details.seekOffset ?? 10;
      const nextTime = clamp(audio.currentTime + seekOffset, 0, safeDuration);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    });
    setActionHandler("seekto", (details) => {
      const audio = audioRef.current;
      if (!audio || typeof details.seekTime !== "number") return;
      const safeDuration = Number.isFinite(audio.duration) ? audio.duration : (duration || details.seekTime);
      const nextTime = clamp(details.seekTime, 0, safeDuration);
      if (typeof audio.fastSeek === "function" && details.fastSeek) {
        audio.fastSeek(nextTime);
      } else {
        audio.currentTime = nextTime;
      }
      setCurrentTime(nextTime);
    });

    return () => {
      mediaActions.forEach((action) => setActionHandler(action, null));
    };
  }, [currentTrack, duration, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const safeDuration = Number.isFinite(duration) ? duration : 0;
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

  const play = (track: AudioFile) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const activeTrack = currentTrackRef.current;
    setIsStickyPlayerVisible(true);

    // If same track, just resume
    if (activeTrack?.id === track.id && audio.src) {
      void audio.play().catch((error) => {
        console.error("[Player] Resume failed:", error);
      });
      return;
    }

    if (activeTrack?.id && Number.isFinite(audio.currentTime)) {
      persistListeningProgress(activeTrack.id, audio.currentTime);
    }

    // Load new track
    currentTrackRef.current = track;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    setIsBuffering(true);
    lastSavedSecondRef.current = -1;

    audio.src = track.blobUrl;
    audio.load();

    void audio.play().catch((error) => {
      console.error("[Player] Playback start failed:", error);
      setIsBuffering(false);
      setIsPlaying(false);
    });
  };

  const pause = () => {
    audioRef.current?.pause();
  };

  const resume = () => {
    if (!audioRef.current) return;
    void audioRef.current.play().catch((error) => {
      console.error("[Player] Resume failed:", error);
      setIsBuffering(false);
      setIsPlaying(false);
    });
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      const safeDuration = Number.isFinite(duration) ? duration : audioRef.current.duration;
      const upperBound = Number.isFinite(safeDuration) ? safeDuration : time;
      const nextTime = clamp(time, 0, upperBound);
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      const trackId = currentTrackRef.current?.id;
      if (trackId) {
        lastSavedSecondRef.current = Math.floor(nextTime);
        persistListeningProgress(trackId, nextTime);
      }
    }
  };

  const setVolume = (vol: number) => {
    const safeVolume = clamp(vol, 0, 1);
    setVolumeState(safeVolume);
    if (safeVolume > 0) {
      lastVolumeBeforeMuteRef.current = safeVolume;
      setMuted(false);
    }
  };

  const toggleMute = () => {
    if (muted || volume === 0) {
      const restoredVolume = lastVolumeBeforeMuteRef.current > 0
        ? lastVolumeBeforeMuteRef.current
        : 0.7;
      setVolumeState(restoredVolume);
      setMuted(false);
      return;
    }

    lastVolumeBeforeMuteRef.current = volume;
    setMuted(true);
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(clamp(rate, 0.5, 2));
  };

  const closeStickyPlayer = () => {
    setIsStickyPlayerVisible(false);
  };

  const showStickyPlayer = () => {
    if (!currentTrackRef.current) return;
    setIsStickyPlayerVisible(true);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isStickyPlayerVisible,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        muted,
        playbackRate,
        play,
        pause,
        resume,
        seek,
        setVolume,
        toggleMute,
        setPlaybackRate,
        closeStickyPlayer,
        showStickyPlayer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
