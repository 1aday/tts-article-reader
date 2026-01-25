'use client';

import { usePlayer } from '@/contexts/PlayerContext';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, FileText } from 'lucide-react';
import { useState } from 'react';

export function PersistentPlayer() {
  const {
    currentTrack,
    isPlaying,
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
  } = usePlayer();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const skipTime = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    seek(newTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#181818] border-t border-[#282828] z-50 animate-slide-up">
      {/* Progress Bar */}
      <div className="h-1 bg-[#404040] relative group cursor-pointer" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        seek(percentage * duration);
      }}>
        <div
          className="absolute inset-y-0 left-0 bg-[#e50914] transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {/* Player Content */}
      <div className="px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-8">
          {/* Left: Track Info with Thumbnail */}
          <div className="flex items-center gap-4 flex-1 min-w-0 max-w-md">
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded bg-[#282828] flex-shrink-0 overflow-hidden">
              {currentTrack.articleImageUrl ? (
                <img
                  src={currentTrack.articleImageUrl}
                  alt={currentTrack.articleTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#b3b3b3]" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">
                {currentTrack.articleTitle}
              </div>
              <div className="text-[#b3b3b3] text-xs truncate">
                {currentTrack.voiceName}
              </div>
            </div>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {/* Control Buttons */}
            <div className="flex items-center gap-4">
              {/* Skip Backward */}
              <button
                onClick={() => skipTime(-10)}
                className="text-[#b3b3b3] hover:text-white transition-colors"
                title="Rewind 10s"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={isPlaying ? pause : resume}
                className="w-10 h-10 rounded-full bg-white hover:scale-105 transition-transform flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-black fill-black" />
                ) : (
                  <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                )}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => skipTime(10)}
                className="text-[#b3b3b3] hover:text-white transition-colors"
                title="Forward 10s"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Time Display */}
            <div className="text-[#b3b3b3] text-xs flex items-center gap-2">
              <span>{formatTime(currentTime)}</span>
              <span className="text-[#535353]">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Volume & Speed */}
          <div className="flex items-center gap-4 flex-1 justify-end max-w-md">
            {/* Playback Speed */}
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="bg-transparent text-[#b3b3b3] hover:text-white text-sm border border-[#404040] hover:border-[#b3b3b3] rounded px-3 py-1.5 cursor-pointer focus:outline-none focus:border-white transition-colors"
            >
              <option value="0.5" className="bg-[#282828]">0.5x</option>
              <option value="0.75" className="bg-[#282828]">0.75x</option>
              <option value="1" className="bg-[#282828]">1x</option>
              <option value="1.25" className="bg-[#282828]">1.25x</option>
              <option value="1.5" className="bg-[#282828]">1.5x</option>
              <option value="1.75" className="bg-[#282828]">1.75x</option>
              <option value="2" className="bg-[#282828]">2x</option>
            </select>

            {/* Volume Control */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="text-[#b3b3b3] hover:text-white transition-colors"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              {/* Volume Slider - Always Visible */}
              <div className="w-24 relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 bg-[#404040] rounded-lg appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-3
                           [&::-webkit-slider-thumb]:h-3
                           [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-white
                           [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-webkit-slider-thumb]:opacity-0
                           hover:[&::-webkit-slider-thumb]:opacity-100
                           [&::-moz-range-thumb]:w-3
                           [&::-moz-range-thumb]:h-3
                           [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:bg-white
                           [&::-moz-range-thumb]:border-0
                           [&::-moz-range-thumb]:cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #b3b3b3 0%, #b3b3b3 ${(muted ? 0 : volume) * 100}%, #404040 ${(muted ? 0 : volume) * 100}%, #404040 100%)`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
