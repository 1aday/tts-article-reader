"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Play,
  Home,
  RotateCcw,
  CheckCircle,
  XCircle,
  Download,
  Sparkles,
  AudioWaveform,
  Upload,
  Clock3,
} from "lucide-react";
import { TimeMetricsCards } from "@/components/generation/TimeMetricsCards";
import { StageDetailsCard } from "@/components/generation/StageDetailsCard";
import { AudioSizeSparkline } from "@/components/generation/AudioSizeSparkline";
import { DetailedStatsTable } from "@/components/generation/DetailedStatsTable";
import { DEFAULT_VOICE_AUDIO_SETTINGS, parseAudioSettingParam } from "@/lib/audio-settings";
import { downloadAudioFile } from "@/lib/download-audio";

const ACTIVE_JOB_STATUSES = new Set(["pending", "enhancing", "generating", "uploading"]);
type GenerationStage = "enhance" | "generate" | "upload" | "complete";
type EnhancementState = "pending" | "running" | "reused" | "completed" | "skipped";

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const getStageFromProgress = (progress: number, enhancementEnabled: boolean): GenerationStage => {
  if (progress >= 100) return "complete";
  if (progress >= 75) return "upload";
  if (progress >= 40) return "generate";
  return enhancementEnabled ? "enhance" : "generate";
};

const getEnhancementStateFromStep = (
  step: string | undefined,
  enhancementEnabled: boolean,
  progress: number
): EnhancementState => {
  if (!enhancementEnabled) return "skipped";
  const normalized = step?.toLowerCase() || "";

  if (normalized.includes("using saved enhanced text")) return "reused";
  if (normalized.includes("text enhancement complete")) return "completed";
  if (normalized.includes("skipping ai enhancement") || normalized.includes("ai enhancement skipped")) {
    return "skipped";
  }
  if (normalized.includes("starting ai enhancement") || normalized.includes("enhancing text")) {
    return "running";
  }

  if (progress >= 40) {
    return "completed";
  }

  return "pending";
};

export default function GeneratePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const articleId = parseInt(params.articleId as string);
  const voiceId = searchParams.get("voiceId");
  const voiceName = searchParams.get("voiceName");
  const skipEnhancement = searchParams.get("skipEnhancement") === "true";
  const enhancementEnabled = !skipEnhancement;

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [audioFileId, setAudioFileId] = useState<number | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);
  const [completedChunks, setCompletedChunks] = useState(0);
  const [currentStage, setCurrentStage] = useState<GenerationStage>(
    enhancementEnabled ? "enhance" : "generate"
  );
  const [enhancementState, setEnhancementState] = useState<EnhancementState>(
    enhancementEnabled ? "pending" : "skipped"
  );
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [chunkSize, setChunkSize] = useState<string>("");
  const [canCloseInfo, setCanCloseInfo] = useState(false);

  // Time tracking & metrics
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [wordsProcessed, setWordsProcessed] = useState(0);
  const [wordsPerSecond, setWordsPerSecond] = useState(0);
  const [chunksPerMinute, setChunksPerMinute] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0); // in seconds

  // File size tracking
  const [audioSizeAccumulated, setAudioSizeAccumulated] = useState(0); // in MB
  const [audioSizeHistory, setAudioSizeHistory] = useState<number[]>([]); // for sparkline
  const [estimatedTotalSize, setEstimatedTotalSize] = useState(0);
  const [estimatedAudioDuration, setEstimatedAudioDuration] = useState(0); // in minutes

  // Detailed chunk info
  const [currentChunkDetails, setCurrentChunkDetails] = useState<{
    index: number;
    totalChars: number;
    startTime: number;
  } | null>(null);
  const [chunkTimings, setChunkTimings] = useState<number[]>([]); // seconds per chunk

  // Batch info
  const [batchInfo, setBatchInfo] = useState<{
    current: number;
    total: number;
    parallel: number;
  } | null>(null);

  const statusQuery = new URLSearchParams({ articleId: String(articleId) });
  if (voiceId) {
    statusQuery.set("voiceId", voiceId);
  }
  const statusUrl = `/api/generate/status?${statusQuery.toString()}`;

  const syncEnhancementState = (step: string | undefined, progressValue: number) => {
    const next = getEnhancementStateFromStep(step, enhancementEnabled, progressValue);
    setEnhancementState((previous) => {
      if (next === "pending" && previous !== "pending") {
        return previous;
      }
      if (next === "completed" && previous === "reused") {
        return "reused";
      }
      return next;
    });
  };

  // Check for existing job first, then start generation or poll
  useEffect(() => {
    if (!voiceId) {
      toast.error("Voice ID is required");
      router.push(`/voice-select/${articleId}`);
      return;
    }

    checkExistingJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, voiceId, enhancementEnabled]);

  // Timer effect for real-time metrics calculation
  useEffect(() => {
    if (!isComplete && !error && startTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsed);

        // Calculate words per second
        if (wordCount > 0 && elapsed > 0) {
          setWordsPerSecond(Math.floor(wordsProcessed / elapsed));
        }

        // Calculate chunks per minute
        if (completedChunks > 0 && elapsed > 0) {
          setChunksPerMinute((completedChunks / elapsed) * 60);
        }

        // Estimate time remaining
        if (completedChunks > 0 && totalChunks > 0) {
          const avgTimePerChunk = elapsed / completedChunks;
          const remainingChunks = totalChunks - completedChunks;
          setEstimatedTimeRemaining(Math.floor(avgTimePerChunk * remainingChunks));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isComplete, error, startTime, completedChunks, totalChunks, wordsProcessed, wordCount]);

  const checkExistingJob = async () => {
    try {
      const response = await fetch(statusUrl);

      if (response.ok) {
        const data = await response.json();
        const safeProgress = clampProgress(data.progress || 0);

        if (ACTIVE_JOB_STATUSES.has(data.status)) {
          // Job is in progress, start polling
          setProgress(safeProgress);
          setCurrentStep(data.currentStep || "Processing...");
          setCurrentStage(getStageFromProgress(safeProgress, enhancementEnabled));
          syncEnhancementState(data.currentStep || undefined, safeProgress);
          const startedAtMs = data.startedAt ? new Date(data.startedAt).getTime() : Date.now();
          setStartTime(Number.isFinite(startedAtMs) ? startedAtMs : Date.now());
          setCanCloseInfo(true);
          startPolling();
          return;
        }
      }

      // No existing job or failed, start new generation
      startGeneration();
    } catch (err) {
      console.error("Failed to check existing job:", err);
      startGeneration();
    }
  };

  const startPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(statusUrl);

        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }

        const data = await response.json();
        const safeProgress = clampProgress(data.progress || 0);

        setProgress(safeProgress);
        setCurrentStep(data.currentStep || "Processing...");
        setCurrentStage(getStageFromProgress(safeProgress, enhancementEnabled));
        syncEnhancementState(data.currentStep || undefined, safeProgress);

        if (data.currentStep) {
          setActivityLog(prev => {
            const lastEntry = prev[prev.length - 1];
            if (lastEntry === data.currentStep) return prev;
            return [...prev.slice(-4), data.currentStep];
          });
        }

        if (data.status === "completed" && data.audioFile) {
          setProgress(100);
          setCurrentStep("Completed!");
          setCurrentStage("complete");
          setAudioFileId(data.audioFile.id);
          setBlobUrl(data.audioFile.blobUrl);
          setIsComplete(true);
          toast.success("Audio generated successfully!");
          clearInterval(pollInterval);
        } else if (data.status === "completed" && !data.audioFile) {
          // Completed without output should not trap UI at 100%.
          clearInterval(pollInterval);
          setProgress(0);
          setCurrentStep("Starting a new generation...");
          startGeneration();
        } else if (data.status === "failed") {
          setError(data.errorMessage || "Generation failed");
          toast.error(data.errorMessage || "Generation failed");
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000); // Poll every 2 seconds

    // Clean up interval on unmount
    return () => clearInterval(pollInterval);
  };

  const startGeneration = async () => {
    try {
      setProgress(0);
      setCurrentStep("Initializing...");
      setCurrentStage(enhancementEnabled ? "enhance" : "generate");
      setEnhancementState(enhancementEnabled ? "pending" : "skipped");
      setActivityLog([]);
      setTotalChunks(0);
      setCompletedChunks(0);
      setWordCount(0);
      setWordsProcessed(0);
      setChunkSize("");
      setChunkTimings([]);
      setCurrentChunkDetails(null);
      setBatchInfo(null);
      setAudioSizeAccumulated(0);
      setAudioSizeHistory([]);
      setEstimatedTotalSize(0);
      setEstimatedAudioDuration(0);
      setElapsedTime(0);
      setWordsPerSecond(0);
      setChunksPerMinute(0);
      setEstimatedTimeRemaining(0);

      // Initialize start time for metrics tracking
      setStartTime(Date.now());
      console.log(`[Generate UI] Starting generation for article ${articleId}`);

      // Parse audio settings from URL params
      const stability = parseAudioSettingParam(
        searchParams.get("stability"),
        DEFAULT_VOICE_AUDIO_SETTINGS.stability
      );
      const similarityBoost = parseAudioSettingParam(
        searchParams.get("similarityBoost"),
        DEFAULT_VOICE_AUDIO_SETTINGS.similarityBoost
      );
      const style = parseAudioSettingParam(
        searchParams.get("style"),
        DEFAULT_VOICE_AUDIO_SETTINGS.style
      );
      const useSpeakerBoost = searchParams.get("useSpeakerBoost") !== "false";

      console.log(`[Generate UI] Audio settings:`, { stability, similarityBoost, style, useSpeakerBoost, skipEnhancement });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId,
          voiceId,
          voiceName: voiceName || undefined,
          skipEnhancement,
          stability,
          similarityBoost,
          style,
          useSpeakerBoost,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      console.log(`[Generate UI] SSE stream connected, reading events...`);

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                const stepText = data.step || "Processing...";
                const safeProgress = clampProgress(data.progress);

                console.log(`[Generate UI] Progress: ${safeProgress}% - ${stepText}`);
                setProgress(safeProgress);
                setCurrentStep(stepText);
                setCurrentStage(getStageFromProgress(safeProgress, enhancementEnabled));
                syncEnhancementState(stepText, safeProgress);

                // Add to activity log (only if different from last entry)
                setActivityLog((prev) => {
                  const lastEntry = prev[prev.length - 1];
                  if (lastEntry === stepText) return prev;
                  return [...prev.slice(-4), stepText];
                });

                // Extract enhancement word progress from step message
                const sourceCoverageMatch = stepText.match(/(\d+)\s*\/\s*(\d+)\s+source words/i);
                if (sourceCoverageMatch) {
                  const processed = parseInt(sourceCoverageMatch[1], 10);
                  const sourceTotal = parseInt(sourceCoverageMatch[2], 10);
                  setWordCount(sourceTotal);
                  setWordsProcessed(processed);
                } else {
                  const streamedWordsMatch = stepText.match(/(\d+)\s+words streamed/i);
                  if (streamedWordsMatch) {
                    const streamedWords = parseInt(streamedWordsMatch[1], 10);
                    setWordsProcessed(streamedWords);
                    setWordCount((prev) => (prev > 0 ? prev : streamedWords));
                  }
                }

                // Extract chunk size from step message and accumulate
                const chunkSizeMatch = stepText.match(/(\d+\.?\d*)\s*MB/);
                if (chunkSizeMatch) {
                  const sizeMB = parseFloat(chunkSizeMatch[1]);
                  setChunkSize(`${sizeMB} MB`);

                  // Accumulate audio size
                  setAudioSizeAccumulated((prev) => {
                    const newSize = prev + sizeMB;
                    setAudioSizeHistory((prevHistory) => [...prevHistory, newSize]);
                    return newSize;
                  });
                }

                // Track chunk start/completion for timing
                if (stepText.toLowerCase().includes("processing chunk")) {
                  const chunkMatch = stepText.match(/chunk (\d+)/i);
                  if (chunkMatch) {
                    const chunkNum = parseInt(chunkMatch[1], 10);

                    // Complete previous chunk if exists
                    if (currentChunkDetails) {
                      const chunkTime = (Date.now() - currentChunkDetails.startTime) / 1000;
                      setChunkTimings((prev) => [...prev, chunkTime]);
                    }

                    // Start new chunk tracking
                    setCurrentChunkDetails({
                      index: chunkNum,
                      totalChars: 0, // Will be extracted if available in message
                      startTime: Date.now(),
                    });
                  }
                }

                // Update chunk tracking if available
                if (data.totalChunks) {
                  setTotalChunks(data.totalChunks);

                  // Calculate batch info (assuming batches of 3)
                  const batchSize = 3;
                  const totalBatches = Math.ceil(data.totalChunks / batchSize);
                  const currentBatch = data.completedChunks
                    ? Math.floor(data.completedChunks / batchSize) + 1
                    : 1;

                  setBatchInfo({
                    current: currentBatch,
                    total: totalBatches,
                    parallel: Math.min(batchSize, data.totalChunks - (data.completedChunks || 0)),
                  });
                }

                if (data.completedChunks !== undefined) {
                  setCompletedChunks(data.completedChunks);

                  // Estimate total audio size and duration
                  if (data.totalChunks && audioSizeAccumulated > 0 && data.completedChunks > 0) {
                    const avgSizePerChunk = audioSizeAccumulated / data.completedChunks;
                    const estimatedTotal = avgSizePerChunk * data.totalChunks;
                    setEstimatedTotalSize(estimatedTotal);

                    // Rough estimate: ~10 MB per minute of audio (at 128kbps)
                    setEstimatedAudioDuration(estimatedTotal / 10);
                  }
                }

                // Extract metadata if provided by backend
                if (data.chunkMetadata) {
                  if (data.chunkMetadata.characterCount && currentChunkDetails) {
                    setCurrentChunkDetails((prev) =>
                      prev
                        ? {
                            ...prev,
                            totalChars: data.chunkMetadata.characterCount,
                          }
                        : null
                    );
                  }

                  if (data.chunkMetadata.batchNumber && data.chunkMetadata.totalBatches) {
                    setBatchInfo({
                      current: data.chunkMetadata.batchNumber,
                      total: data.chunkMetadata.totalBatches,
                      parallel: data.chunkMetadata.parallelChunks || 3,
                    });
                  }
                }
            } else if (data.type === "complete") {
              setProgress(100);
              setCurrentStep("Completed!");
              setCurrentStage("complete");
              setAudioFileId(data.audioFileId);
              setBlobUrl(data.blobUrl);
              setIsComplete(true);
              toast.success("Audio generated successfully!");
            } else if (data.type === "error") {
              setError(data.error);
              toast.error(data.error);
            }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", line, parseError);
              // Continue reading other lines even if one fails
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
      toast.error(message);
    }
  };

  const handlePlayAudio = () => {
    if (audioFileId) {
      router.push(`/player/${audioFileId}`);
    }
  };

  const handleRetry = () => {
    setProgress(0);
    setCurrentStep("Initializing...");
    setError(null);
    setIsComplete(false);
    setCurrentStage(enhancementEnabled ? "enhance" : "generate");
    setEnhancementState(enhancementEnabled ? "pending" : "skipped");
    startGeneration();
  };

  const handleDownload = async () => {
    try {
      if (!audioFileId) {
        throw new Error("Audio file is not ready for download");
      }
      await downloadAudioFile(audioFileId);

      toast.success("Full audio download started.");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download audio");
    }
  };

  const isRunning = !error && !isComplete;
  const enhancementStepDone =
    !enhancementEnabled ||
    enhancementState === "completed" ||
    enhancementState === "reused" ||
    enhancementState === "skipped" ||
    progress >= 40;
  const enhancementModeLabel = enhancementEnabled
    ? enhancementState === "reused"
      ? "Enabled (using saved enhanced text)"
      : "Enabled (Optional)"
    : "Skipped (Optional)";
  const enhancementModeDescription = enhancementEnabled
    ? "AI can optimize punctuation and pacing before speech generation."
    : "Original article text is used directly for a faster run.";

  const stageOrder: Array<{
    id: GenerationStage;
    label: string;
    description: string;
  }> = [
    {
      id: "enhance",
      label: enhancementEnabled ? "Enhance (Optional)" : "Enhance (Skipped)",
      description: enhancementEnabled
        ? enhancementState === "reused"
          ? "Using saved AI-enhanced text"
          : "LLM punctuation and pacing optimization"
        : "Original script used directly",
    },
    { id: "generate", label: "Generate", description: "Create multi-chunk voice audio" },
    { id: "upload", label: "Finalize", description: "Merge and upload the file" },
    { id: "complete", label: "Ready", description: "Playable output available" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090d] pt-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.2),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(229,9,20,0.08),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07090d]/80 to-[#07090d]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)]" />

      <main className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="hero-panel relative mb-6 overflow-hidden rounded-3xl p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(229,9,20,0.16),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(229,9,20,0.1),transparent_45%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff4a55]/80 to-transparent" />
          <div className="relative grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e50914]/35 bg-[#e50914]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff5660] shadow-[0_8px_24px_rgba(229,9,20,0.2)]">
                Audio Generation
              </div>

              <h1 className="bg-gradient-to-b from-white to-white/75 bg-clip-text font-display text-4xl leading-[1.02] text-transparent drop-shadow-[0_12px_32px_rgba(0,0,0,0.55)] sm:text-5xl md:text-6xl lg:text-7xl">
                {error ? "Generation Failed" : isComplete ? "Audio Ready" : "Building Audio"}
              </h1>

              <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                {isComplete
                  ? "Your narration is rendered and ready to play or download."
                  : error
                  ? "The generation process stopped before completion."
                  : currentStep}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e50914]/20 bg-[linear-gradient(145deg,rgba(229,9,20,0.1),rgba(9,12,18,0.7))] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className={`mt-0.5 h-4 w-4 ${enhancementEnabled ? "text-[#e50914]" : "text-white/60"}`} />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/45">LLM Enhancement</p>
                      <p className="mt-1 text-sm font-semibold text-white">{enhancementModeLabel}</p>
                      <p className="mt-1 text-xs text-white/55">{enhancementModeDescription}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(9,12,18,0.72))] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-white/45">Voice Profile</p>
                  <p className="mt-1 text-sm font-semibold text-white">{voiceName || "Selected Voice"}</p>
                  <p className="mt-1 text-xs text-white/55">
                    {voiceId ? `Voice ID: ${voiceId}` : "Using selected voice configuration."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-white/55">
                  <span>Overall Progress</span>
                  <span className="text-[#e50914]">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-white/8">
                  <div
                    className="h-full bg-gradient-to-r from-[#e50914] via-[#ff2633] to-[#b20710] shadow-[0_0_16px_rgba(229,9,20,0.55)] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px] tracking-[0.1em] text-white/40">
                  <span className={progress >= 1 ? "text-[#e50914]" : ""}>Start</span>
                  <span className={enhancementStepDone ? "text-[#e50914]" : ""}>
                    {enhancementEnabled ? "Enhance (opt)" : "Skip Enhance"}
                  </span>
                  <span className={progress >= 75 ? "text-[#e50914]" : ""}>Generate</span>
                  <span className={progress >= 100 ? "text-[#e50914]" : ""}>Ready</span>
                </div>
              </div>
            </div>

            <div className="status-panel rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-white/50">
                <span>Status</span>
                <span className="text-[#e50914]">{progress}%</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-[#0d121b] shadow-[0_0_0_1px_rgba(229,9,20,0.2),0_16px_40px_rgba(0,0,0,0.45)]">
                  {error ? (
                    <XCircle className="h-10 w-10 text-red-400" />
                  ) : isComplete ? (
                    <CheckCircle className="h-10 w-10 text-[#e50914]" />
                  ) : (
                    <div className="relative h-10 w-10">
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#e50914] border-r-[#e50914]/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {error ? "Action Required" : isComplete ? "Ready To Listen" : "Rendering in progress"}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    {error
                      ? "Try again with the same voice settings."
                      : isComplete
                      ? "Playback and download are now available."
                      : enhancementEnabled
                      ? "Optional enhancement is active, followed by audio rendering."
                      : "Enhancement is skipped; rendering directly from original text."}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-white/12 bg-white/5 p-3">
                  <div className="text-white/50">Chunks</div>
                  <div className="mt-1 font-semibold text-white">
                    {completedChunks}/{totalChunks || "--"}
                  </div>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/5 p-3">
                  <div className="text-white/50">Size</div>
                  <div className="mt-1 font-semibold text-white">
                    {audioSizeAccumulated > 0 ? `${audioSizeAccumulated.toFixed(1)} MB` : "--"}
                  </div>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/5 p-3">
                  <div className="text-white/50">Enhancement</div>
                  <div className="mt-1 font-semibold text-white">
                    {enhancementEnabled ? "Enabled" : "Skipped"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {canCloseInfo && isRunning && (
          <section className="mb-6 rounded-2xl border border-[#e50914]/35 bg-[linear-gradient(135deg,rgba(229,9,20,0.14),rgba(10,12,18,0.7))] p-4 text-sm text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
            <span className="font-semibold text-[#e50914]">Background safe: </span>
            You can close this page and come back later. Progress and output are preserved.
          </section>
        )}

        {isRunning && (
          <div className="grid gap-6 lg:grid-cols-[1.16fr_0.84fr]">
            <div className="space-y-6">
              <TimeMetricsCards
                elapsedTime={elapsedTime}
                estimatedRemaining={estimatedTimeRemaining}
                wordsPerSecond={wordsPerSecond}
                chunksPerMinute={chunksPerMinute}
                completedChunks={completedChunks}
                totalChunks={totalChunks}
                isComplete={isComplete}
              />

              <StageDetailsCard
                currentStage={currentStage}
                progress={progress}
                currentStep={currentStep}
                enhancementEnabled={enhancementEnabled}
                enhancementState={enhancementState}
                wordCount={wordCount}
                wordsProcessed={wordsProcessed}
                totalChunks={totalChunks}
                completedChunks={completedChunks}
                currentChunkIndex={currentChunkDetails?.index}
                currentChunkChars={currentChunkDetails?.totalChars}
                audioSizeAccumulated={audioSizeAccumulated}
                estimatedTotalSize={estimatedTotalSize}
                batchInfo={batchInfo || undefined}
              />

              {currentStage === "generate" && audioSizeHistory.length > 0 && (
                <AudioSizeSparkline
                  audioSizeHistory={audioSizeHistory}
                  currentSize={audioSizeAccumulated}
                  estimatedTotal={estimatedTotalSize}
                />
              )}

              {totalChunks > 0 && startTime && (
                <DetailedStatsTable
                  wordCount={wordCount}
                  wordsProcessed={wordsProcessed}
                  totalChunks={totalChunks}
                  completedChunks={completedChunks}
                  chunkTimings={chunkTimings}
                  voiceId={voiceId || undefined}
                  voiceName={voiceName || (voiceId ? "Selected Voice" : undefined)}
                  modelInfo="eleven_v3 (ElevenLabs v3)"
                  estimatedDuration={estimatedAudioDuration}
                  estimatedTotalSize={estimatedTotalSize}
                />
              )}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <section className="info-panel rounded-2xl p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
                  Pipeline
                </h3>
                <div className="space-y-3">
                  {stageOrder.map((stage) => {
                    const isEnhanceStage = stage.id === "enhance";
                    const isActive =
                      isEnhanceStage
                        ? enhancementEnabled && currentStage === "enhance"
                        : currentStage === stage.id || (stage.id === "complete" && isComplete);
                    const isDone =
                      stage.id === "enhance"
                        ? enhancementStepDone
                        : stage.id === "generate"
                        ? progress >= 75
                        : stage.id === "upload"
                        ? progress >= 100
                        : isComplete;

                    const Icon =
                      stage.id === "enhance"
                        ? Sparkles
                        : stage.id === "generate"
                        ? AudioWaveform
                        : stage.id === "upload"
                        ? Upload
                        : CheckCircle;

                    return (
                      <div
                        key={stage.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isActive
                            ? "border-[#e50914]/45 bg-[linear-gradient(140deg,rgba(229,9,20,0.14),rgba(16,10,12,0.55))] shadow-[0_10px_26px_rgba(229,9,20,0.18)]"
                            : isDone
                            ? "border-white/20 bg-white/6"
                            : "border-white/10 bg-black/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 rounded-lg p-1.5 ${
                              isActive || isDone
                                ? "border border-[#e50914]/30 bg-[#e50914]/15 text-[#ff5a64]"
                                : "border border-white/12 bg-white/8 text-white/45"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{stage.label}</p>
                            <p className="text-xs text-white/55">{stage.description}</p>
                          </div>
                          {isActive && (
                            <span className="ml-auto mt-1 h-2 w-2 rounded-full bg-[#ff4f5b] shadow-[0_0_10px_rgba(229,9,20,0.8)]" />
                          )}
                          {isEnhanceStage && !enhancementEnabled && (
                            <span className="ml-auto rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/60">
                              Skipped
                            </span>
                          )}
                          {isDone && (isEnhanceStage ? enhancementEnabled : true) && (
                            <CheckCircle className="ml-auto h-4 w-4 text-[#e50914]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="info-panel rounded-2xl p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-white/60">
                  Live Activity
                </h3>
                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {(activityLog.length > 0 ? activityLog.slice(-6) : ["Waiting for first processing event..."]).map(
                    (log, index) => (
                      <div
                        key={`${log}-${index}`}
                        className="rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-xs text-white/70"
                      >
                        {log}
                      </div>
                    )
                  )}
                </div>
              </section>

              {totalChunks > 1 && (
                <section className="info-panel rounded-2xl p-5">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-white/60">
                    <span>Chunk Timeline</span>
                    <span>{completedChunks}/{totalChunks}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    {Array.from({ length: Math.min(totalChunks, 48) }).map((_, index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full ${
                          index < completedChunks ? "bg-gradient-to-r from-[#e50914] to-[#ff3d49]" : "bg-white/12"
                        }`}
                      />
                    ))}
                  </div>
                  {totalChunks > 48 && (
                    <p className="mt-2 text-[11px] text-white/45">
                      Showing first 48 chunks for compact view.
                    </p>
                  )}
                </section>
              )}
            </aside>
          </div>
        )}

        {error && (
          <section className="mx-auto mt-6 max-w-3xl rounded-3xl border border-red-500/35 bg-red-500/8 p-6 sm:p-8">
            <div className="mb-5 flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-400" />
              <div>
                <h3 className="text-xl font-semibold text-red-300">Generation failed</h3>
                <p className="mt-1 text-sm text-red-200/80">{error}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                onClick={handleRetry}
                size="lg"
                className="h-14 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Retry Generation
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/")}
                className="h-14 border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                <Home className="mr-2 h-5 w-5" />
                Go Home
              </Button>
            </div>
          </section>
        )}

        {isComplete && blobUrl && (
          <section className="complete-panel mx-auto mt-6 max-w-4xl rounded-3xl p-6 sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <CheckCircle className="h-7 w-7 text-[#e50914]" />
              <div>
                <h3 className="font-display text-4xl leading-none text-white sm:text-5xl">Audio Completed</h3>
                <p className="mt-2 text-sm text-white/65">
                  Your generated narration is ready. You can open the player now or save an MP3 copy.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Button
                onClick={handlePlayAudio}
                size="lg"
                className="h-14 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white"
              >
                <Play className="mr-2 h-5 w-5" fill="white" />
                Play Audio
              </Button>
              <Button
                onClick={handleDownload}
                size="lg"
                className="h-14 border border-white/20 bg-white/10 text-white hover:bg-white/15"
              >
                <Download className="mr-2 h-5 w-5" />
                Download MP3
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/")}
                className="h-14 border-white/25 bg-transparent text-white hover:bg-white/10"
              >
                <Home className="mr-2 h-5 w-5" />
                Home
              </Button>
            </div>
          </section>
        )}

        {isRunning && (
          <section className="info-panel mt-6 rounded-2xl px-4 py-3 text-xs text-white/55 sm:text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#e50914]" />
                Processing continuously until completion
              </span>
              <span className="hidden h-4 w-px bg-white/20 sm:block" />
              <span>Article ID: {articleId}</span>
              {chunkSize && (
                <>
                  <span className="hidden h-4 w-px bg-white/20 sm:block" />
                  <span>Latest chunk: {chunkSize}</span>
                </>
              )}
            </div>
          </section>
        )}
      </main>
      <style jsx>{`
        .hero-panel {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            linear-gradient(145deg, rgba(12, 16, 24, 0.92) 0%, rgba(8, 10, 16, 0.9) 55%, rgba(22, 8, 12, 0.86) 100%);
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(229, 9, 20, 0.22);
          backdrop-filter: blur(20px);
        }

        .status-panel {
          border: 1px solid rgba(255, 255, 255, 0.11);
          background:
            linear-gradient(160deg, rgba(7, 10, 16, 0.88) 0%, rgba(8, 10, 15, 0.82) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 20px 54px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(14px);
        }

        .info-panel {
          border: 1px solid rgba(255, 255, 255, 0.11);
          background:
            linear-gradient(150deg, rgba(13, 17, 26, 0.9) 0%, rgba(8, 10, 16, 0.86) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 16px 44px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(12px);
        }

        .complete-panel {
          border: 1px solid rgba(229, 9, 20, 0.4);
          background:
            linear-gradient(145deg, rgba(14, 18, 28, 0.94) 0%, rgba(8, 10, 15, 0.9) 66%, rgba(34, 8, 12, 0.82) 100%);
          box-shadow:
            0 26px 76px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(229, 9, 20, 0.2);
        }
      `}</style>
    </div>
  );
}
