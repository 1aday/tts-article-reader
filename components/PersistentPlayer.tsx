"use client";

import Link from "next/link";
import { usePlayer } from "@/contexts/PlayerContext";
import { Loader2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, Waves, X, Music2 } from "lucide-react";
import { formatDuration } from "@/lib/audio-duration";

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
    return formatDuration(seconds);
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

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const cyclePlaybackRate = () => {
    const index = playbackRates.findIndex((rate) => Math.abs(rate - playbackRate) < 0.001);
    const nextRate = playbackRates[(index + 1) % playbackRates.length];
    setPlaybackRate(nextRate);
  };
  const currentVolume = muted ? 0 : volume;

  return (
    <div className="fixed inset-x-2 bottom-2 z-50 sm:inset-x-3 md:inset-x-4 lg:inset-x-5">
      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(9,13,20,0.97),rgba(12,17,28,0.92))] shadow-[0_16px_52px_rgba(0,0,0,0.56)] backdrop-blur-2xl animate-slideInFromBottom">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_50%_120%,rgba(229,9,20,0.16),transparent_66%)]" />

        <div
          className="relative h-0.5 cursor-pointer bg-white/8"
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

        <div className="relative mx-auto grid w-full max-w-[1700px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-4">
          <Link href={`/player/${currentTrack.id}`} className="group flex min-w-0 items-center gap-2.5">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-white/15 bg-surface-2 sm:h-11 sm:w-11">
              {currentTrack.articleImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentTrack.articleImageUrl}
                  alt={currentTrack.articleTitle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Waves className="h-4 w-4 text-[#e50914]" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white/90 transition-colors group-hover:text-[#ff7c81]">
                {currentTrack.articleTitle}
              </p>
              <p className="truncate text-[11px] text-white/45">{currentTrack.voiceName}</p>
            </div>
          </Link>

          <button
            onClick={closeStickyPlayer}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/55 transition hover:border-white/30 hover:text-white sm:hidden"
            aria-label="Close mini player"
            title="Close mini player"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:col-span-1 sm:justify-center sm:gap-2">
            <button
              onClick={() => skipTime(-10)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/55 transition hover:border-white/15 hover:text-white"
              title="Rewind 10 seconds"
              aria-label="Rewind 10 seconds"
            >
              <SkipBack className="h-[18px] w-[18px]" />
            </button>

            <button
              onClick={isPlaying ? pause : resume}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-[#e50914] to-[#c10812] text-white shadow-[0_8px_18px_rgba(229,9,20,0.35)] transition hover:brightness-110"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-[18px] w-[18px]" fill="white" />
              ) : (
                <Play className="h-[18px] w-[18px]" fill="white" />
              )}
            </button>

            <button
              onClick={() => skipTime(10)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-white/55 transition hover:border-white/15 hover:text-white"
              title="Forward 10 seconds"
              aria-label="Forward 10 seconds"
            >
              <SkipForward className="h-[18px] w-[18px]" />
            </button>

            <div className="hidden items-center text-[11px] text-white/45 sm:flex">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/30">/</span>
              <span>{formatTime(duration)}</span>
              <span className="mx-1 text-white/25">·</span>
              <span>-{formatTime(remaining)}</span>
            </div>

            <button
              onClick={cyclePlaybackRate}
              className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-medium text-white/65 transition hover:border-white/22 hover:text-white"
              aria-label="Cycle playback speed"
              title={`Playback speed ${playbackRate}x`}
            >
              {playbackRate}x
            </button>

            <div className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] pl-1.5 pr-2">
              <button
                onClick={toggleMute}
                className="inline-flex h-5 w-5 items-center justify-center text-white/55 transition hover:text-white"
                aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={currentVolume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="h-1 w-12 cursor-pointer appearance-none rounded-full bg-white/15 sm:w-14 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/90 [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
                aria-label="Volume"
              />
            </div>
          </div>

          <button
            onClick={closeStickyPlayer}
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/55 transition hover:border-white/30 hover:text-white sm:inline-flex"
            aria-label="Close mini player"
            title="Close mini player"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
