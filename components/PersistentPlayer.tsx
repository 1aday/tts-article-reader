"use client";

import Link from "next/link";
import { usePlayer } from "@/contexts/PlayerContext";
import { Loader2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, Waves, X, Music2 } from "lucide-react";

export function PersistentPlayer() {
  const {
    currentTrack,
    isStickyPlayerVisible,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    closeStickyPlayer,
    showStickyPlayer,
  } = usePlayer();

  if (!currentTrack) return null;

  if (!isStickyPlayerVisible) {
    return (
      <button
        onClick={showStickyPlayer}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#090d14]/95 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-xl transition hover:border-[#e50914]/50 hover:text-white"
        aria-label="Show mini player"
        title="Show mini player"
      >
        <Music2 className="h-4 w-4 text-[#e50914]" />
        Player
      </button>
    );
  }

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const remaining = Math.max(0, duration - currentTime);

  const skipTime = (seconds: number) => {
    if (duration <= 0) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    seek(newTime);
  };

  const handleProgressSeek = (percentage: number) => {
    if (duration <= 0) return;
    const clampedPercentage = Math.max(0, Math.min(1, percentage));
    seek(clampedPercentage * duration);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#090d14]/95 backdrop-blur-2xl animate-slideInFromBottom">
      <div
        className="relative h-1 cursor-pointer bg-white/10"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percentage = (e.clientX - rect.left) / rect.width;
          handleProgressSeek(percentage);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#e50914] to-[#b20710] transition-all"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Seek playback"
        />
      </div>

      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <Link href={`/player/${currentTrack.id}`} className="flex min-w-0 items-center gap-3 sm:max-w-md group">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/15 bg-surface-2">
            {currentTrack.articleImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentTrack.articleImageUrl}
                alt={currentTrack.articleTitle}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Waves className="h-5 w-5 text-[#e50914]" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white group-hover:text-[#ff6a70] transition-colors">
              {currentTrack.articleTitle}
            </p>
            <p className="truncate text-xs text-white/55">{currentTrack.voiceName}</p>
          </div>
        </Link>

        <div className="flex flex-1 flex-col items-center gap-2 sm:max-w-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => skipTime(-10)}
              className="text-white/65 transition hover:text-white"
              title="Rewind 10 seconds"
              aria-label="Rewind 10 seconds"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={isPlaying ? pause : resume}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#e50914] to-[#b20710] text-white shadow-[0_10px_24px_rgba(229,9,20,0.4)] transition hover:brightness-110"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" fill="white" />
              ) : (
                <Play className="h-5 w-5" fill="white" />
              )}
            </button>
            <button
              onClick={() => skipTime(10)}
              className="text-white/65 transition hover:text-white"
              title="Forward 10 seconds"
              aria-label="Forward 10 seconds"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          <div className="text-xs text-white/55 flex items-center gap-2">
            {formatTime(currentTime)} <span className="mx-1 text-white/35">/</span> {formatTime(duration)}
            <span className="text-white/35">·</span>
            <span>-{formatTime(remaining)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end sm:max-w-md">
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="rounded-lg border border-white/15 bg-surface-2 px-2 py-1.5 text-xs font-semibold text-white/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]"
            aria-label="Playback speed"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="1.75">1.75x</option>
            <option value="2">2x</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-white/65 transition hover:text-white"
              aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/15 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              aria-label="Volume"
            />
          </div>
          <button
            onClick={closeStickyPlayer}
            className="rounded-full border border-white/15 p-1.5 text-white/65 transition hover:border-white/35 hover:text-white"
            aria-label="Close mini player"
            title="Close mini player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
