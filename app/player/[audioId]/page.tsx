"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Play, Pause, Home, Library, Download, Volume2, VolumeX,
  SkipBack, SkipForward, RefreshCw, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import { VoiceSelector } from "@/components/voice-selector";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { AudioSettingsPanel } from "@/components/audio-settings-panel";

interface Article {
  id: number;
  title: string;
  wordCount: number;
  sourceType: string;
  createdAt: string;
}

interface AudioFile {
  id: number;
  voiceName: string;
  duration: number;
  fileSize: number;
  createdAt: string;
  blobUrl: string;
}

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const audioId = parseInt(params.audioId as string);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<AudioFile | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [allAudioVersions, setAllAudioVersions] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Regeneration panel state
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState(true);
  const [keepOldVersion, setKeepOldVersion] = useState(true);

  // Confirmation dialogs
  const [showDeleteAudioDialog, setShowDeleteAudioDialog] = useState(false);
  const [showDeleteArticleDialog, setShowDeleteArticleDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    loadAudio();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (playing && audioRef.current && !analyzerRef.current) {
      setupVisualizer();
    }
  }, [playing]);

  const setupVisualizer = () => {
    if (!audioRef.current || !canvasRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyzer = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(audioRef.current);

    source.connect(analyzer);
    analyzer.connect(audioContext.destination);

    analyzer.fftSize = 256;
    audioContextRef.current = audioContext;
    analyzerRef.current = analyzer;

    drawVisualizer();
  };

  const drawVisualizer = () => {
    if (!analyzerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!playing) return;

      requestAnimationFrame(draw);

      analyzerRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        const hue = (i / bufferLength) * 120 + 140;
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.8)`;

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const loadAudio = async () => {
    try {
      const response = await fetch(`/api/audio/${audioId}`);

      if (!response.ok) {
        toast.error("Failed to load audio");
        return;
      }

      const data = await response.json();
      setAudioUrl(data.blobUrl);
      setAudioData(data);

      // Load article info
      const articleRes = await fetch(`/api/article/${data.articleId}`);
      if (articleRes.ok) {
        const articleData = await articleRes.json();
        setArticle(articleData);

        // Load all audio versions
        const versionsRes = await fetch(`/api/audio/list/${data.articleId}`);
        if (versionsRes.ok) {
          const versions = await versionsRes.json();
          setAllAudioVersions(versions);
        }
      }

      setLoading(false);
    } catch (error) {
      toast.error("Failed to load audio");
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol === 0) {
      setMuted(true);
    } else {
      setMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const handleDownload = async () => {
    if (!audioUrl) return;

    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audio-${audioId}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Audio downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download audio");
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
      router.push(`/generate/${article.id}?voiceId=${selectedVoiceId}`);
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
    <div className="min-h-screen bg-[#141414] relative overflow-hidden p-4 pt-16">
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

      <div className="relative max-w-5xl mx-auto py-8">
        {/* Article Info Section */}
        {article && (
          <div className="bg-black/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {article.title}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                  <span>{article.wordCount} words</span>
                  <span>•</span>
                  <span>{article.sourceType}</span>
                  <span>•</span>
                  <span>{formatDate(article.createdAt)}</span>
                </div>
              </div>
              {allAudioVersions.length > 1 && (
                <div className="px-3 py-1 rounded-full bg-[#e50914]/10 border border-[#e50914]/20 text-[#e50914] text-sm">
                  {allAudioVersions.length} versions
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-black/60 backdrop-blur-xl border border-gray-800/50 rounded-3xl p-6 sm:p-10 md:p-14 shadow-2xl">
          <div className="space-y-8 sm:space-y-12">
            {/* Header with Audio Info */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e50914]/10 border border-[#e50914]/20">
                <div className="w-2 h-2 rounded-full bg-[#e50914] animate-pulse" />
                <span className="text-sm font-medium text-[#e50914]">
                  {playing ? "Now Playing" : "Ready"}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
                {audioData?.voiceName || "Audio Player"}
              </h1>

              {/* Audio Stats */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <span>Duration:</span>
                  <span className="text-[#e50914]">{formatTime(duration)}</span>
                </div>
                {audioData?.fileSize && (
                  <>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex items-center gap-2">
                      <span>Size:</span>
                      <span className="text-[#e50914]">{formatFileSize(audioData.fileSize)}</span>
                    </div>
                  </>
                )}
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-2">
                  <span>Speed:</span>
                  <span className="text-[#e50914]">{playbackRate}x</span>
                </div>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={audioUrl ? `/api/audio/proxy?url=${encodeURIComponent(audioUrl)}` : undefined}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={(e) => {
                console.error("Audio playback error:", e);
                toast.error("Failed to load audio. Please try downloading instead.");
              }}
              crossOrigin="anonymous"
              preload="metadata"
            />

            {/* Visualizer */}
            <div className="relative h-32 sm:h-40 md:h-48 rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-full"
              />
              {!playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white/30 text-sm sm:text-base">Audio visualizer will appear during playback</div>
                </div>
              )}
            </div>

            {/* Main Controls */}
            <div className="space-y-6 sm:space-y-8">
              {/* Play/Pause and Skip Controls */}
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <button
                  onClick={() => skip(-10)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#e50914]/30 transition-all flex items-center justify-center group"
                >
                  <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 text-white/70 group-hover:text-[#e50914] transition-colors" />
                </button>

                <button
                  onClick={togglePlay}
                  className="relative group w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-[#e50914] hover:bg-[#f40612] transition-all hover:scale-105 shadow-2xl shadow-[#e50914]/30 hover:shadow-[#e50914]/50"
                >
                  <div className="absolute inset-0 rounded-full bg-[#e50914] blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative flex items-center justify-center w-full h-full">
                    {playing ? (
                      <Pause className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white" fill="white" />
                    ) : (
                      <Play className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white ml-1 sm:ml-2" fill="white" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => skip(10)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#e50914]/30 transition-all flex items-center justify-center group"
                >
                  <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 text-white/70 group-hover:text-[#e50914] transition-colors" />
                </button>
              </div>

              {/* Progress Bar with Time */}
              <div className="space-y-3">
                <div className="relative group">
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#e50914] rounded-full transition-all relative"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="px-3 py-1 rounded-lg bg-black/90 border border-[#e50914]/30 text-xs text-white whitespace-nowrap">
                      {formatTime(currentTime)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-sm sm:text-base text-white/60 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Additional Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                {/* Volume Control */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    onMouseEnter={() => setShowVolumeSlider(true)}
                    onMouseLeave={() => setTimeout(() => setShowVolumeSlider(false), 200)}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#e50914]/30 transition-all flex items-center justify-center group"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-white/70 group-hover:text-[#e50914] transition-colors" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white/70 group-hover:text-[#e50914] transition-colors" />
                    )}
                  </button>

                  {showVolumeSlider && (
                    <div
                      className="relative w-24 h-1.5 bg-white/10 rounded-full overflow-hidden"
                      onMouseEnter={() => setShowVolumeSlider(true)}
                      onMouseLeave={() => setShowVolumeSlider(false)}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-[#e50914] rounded-full"
                        style={{ width: `${volume * 100}%` }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Playback Speed */}
                <div className="flex items-center gap-2">
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackRate(speed)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        playbackRate === speed
                          ? "bg-[#e50914] text-white shadow-lg shadow-[#e50914]/30"
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Regeneration Panel */}
            <div className="border-t border-white/10 pt-6">
              <button
                onClick={() => setShowRegeneratePanel(!showRegeneratePanel)}
                className="w-full flex items-center justify-between p-4 bg-[#e50914]/5 hover:bg-[#e50914]/10 border border-[#e50914]/20 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-[#e50914]" />
                  <span className="text-white font-semibold">Regenerate Audio</span>
                </div>
                {showRegeneratePanel ? (
                  <ChevronUp className="w-5 h-5 text-white/50 group-hover:text-[#e50914] transition-colors" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/50 group-hover:text-[#e50914] transition-colors" />
                )}
              </button>

              {showRegeneratePanel && (
                <div className="mt-6 p-6 bg-black/40 border border-white/10 rounded-xl space-y-6 animate-fadeIn">
                  <VoiceSelector
                    selectedVoiceId={selectedVoiceId}
                    onVoiceSelect={(voiceId) => setSelectedVoiceId(voiceId)}
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
                  />

                  <div className="flex items-center gap-3 p-4 bg-black/40 rounded-lg border border-white/10">
                    <input
                      type="checkbox"
                      id="keepOldVersion"
                      checked={keepOldVersion}
                      onChange={(e) => setKeepOldVersion(e.target.checked)}
                      className="w-5 h-5 rounded border-white/20 bg-white/5"
                    />
                    <label htmlFor="keepOldVersion" className="text-sm text-white">
                      Keep current version (create new audio file)
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowRegeneratePanel(false)}
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-6 border-t border-white/10">
              <Button
                onClick={handleDownload}
                className="netflix-button netflix-button-primary h-12 sm:h-14 rounded-xl font-bold text-sm sm:text-base"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Download
              </Button>

              <Button
                onClick={() => router.push("/library")}
                className="netflix-button netflix-button-secondary h-12 sm:h-14 rounded-xl font-semibold"
              >
                <Library className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Library
              </Button>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-red-500/20 pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
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

            {/* Other Versions */}
            {allAudioVersions.length > 1 && (
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Other Audio Versions ({allAudioVersions.length - 1})
                </h3>
                <div className="space-y-2">
                  {allAudioVersions
                    .filter((v) => v.id !== audioId)
                    .map((version) => (
                      <button
                        key={version.id}
                        onClick={() => router.push(`/player/${version.id}`)}
                        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#e50914]/30 rounded-lg transition-all text-left"
                      >
                        <div>
                          <div className="text-white font-medium">{version.voiceName}</div>
                          <div className="text-xs text-white/50 mt-1">
                            {formatTime(version.duration)} • {formatFileSize(version.fileSize)} • {formatDate(version.createdAt)}
                          </div>
                        </div>
                        <Play className="w-5 h-5 text-[#e50914]" />
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
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
      `}</style>
    </div>
  );
}
