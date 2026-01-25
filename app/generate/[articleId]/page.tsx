"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Home, RotateCcw, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { TimeMetricsCards } from "@/components/generation/TimeMetricsCards";
import { StageDetailsCard } from "@/components/generation/StageDetailsCard";
import { AudioSizeSparkline } from "@/components/generation/AudioSizeSparkline";
import { DetailedStatsTable } from "@/components/generation/DetailedStatsTable";

export default function GeneratePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const articleId = parseInt(params.articleId as string);
  const voiceId = searchParams.get("voiceId");

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [audioFileId, setAudioFileId] = useState<number | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);
  const [completedChunks, setCompletedChunks] = useState(0);
  const [currentStage, setCurrentStage] = useState<"enhance" | "generate" | "upload" | "complete">("enhance");
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [chunkSize, setChunkSize] = useState<string>("");
  const [usePolling, setUsePolling] = useState(false);
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

  // Check for existing job first, then start generation or poll
  useEffect(() => {
    if (!voiceId) {
      toast.error("Voice ID is required");
      router.push(`/voice-select/${articleId}`);
      return;
    }

    checkExistingJob();
  }, [articleId, voiceId]);

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
      const response = await fetch(`/api/generate/status?articleId=${articleId}`);

      if (response.ok) {
        const data = await response.json();

        if (data.status === "completed" && data.audioFile) {
          // Job already complete
          setProgress(100);
          setCurrentStep("Completed!");
          setCurrentStage("complete");
          setAudioFileId(data.audioFile.id);
          setBlobUrl(data.audioFile.blobUrl);
          setIsComplete(true);
          return;
        } else if (data.status !== "not_found" && data.status !== "failed") {
          // Job is in progress, start polling
          setProgress(data.progress || 0);
          setCurrentStep(data.currentStep || "Processing...");
          setUsePolling(true);
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
        const response = await fetch(`/api/generate/status?articleId=${articleId}`);

        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }

        const data = await response.json();

        setProgress(data.progress || 0);
        setCurrentStep(data.currentStep || "Processing...");

        if (data.currentStep) {
          setActivityLog(prev => {
            const lastEntry = prev[prev.length - 1];
            if (lastEntry === data.currentStep) return prev;
            return [...prev.slice(-4), data.currentStep];
          });
        }

        // Update stage based on progress
        if (data.progress < 40) {
          setCurrentStage("enhance");
        } else if (data.progress < 75) {
          setCurrentStage("generate");
        } else if (data.progress < 100) {
          setCurrentStage("upload");
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
      // Initialize start time for metrics tracking
      setStartTime(Date.now());
      console.log(`[Generate UI] Starting generation for article ${articleId}`);

      // Parse audio settings from URL params
      const stability = parseFloat(searchParams.get("stability") || "0.5");
      const similarityBoost = parseFloat(searchParams.get("similarityBoost") || "0.75");
      const style = parseFloat(searchParams.get("style") || "0");
      const useSpeakerBoost = searchParams.get("useSpeakerBoost") !== "false";

      console.log(`[Generate UI] Audio settings:`, { stability, similarityBoost, style, useSpeakerBoost });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId,
          voiceId,
          skipEnhancement: false,
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
              console.log(`[Generate UI] Progress: ${data.progress}% - ${data.step}`);
              setProgress(data.progress);
              setCurrentStep(data.step);

              // Add to activity log (only if different from last entry)
              setActivityLog(prev => {
                const lastEntry = prev[prev.length - 1];
                if (lastEntry === data.step) return prev;
                return [...prev.slice(-4), data.step];
              });

              // Extract word count from step message
              const wordMatch = data.step.match(/(\d+)\s+words/i);
              if (wordMatch) {
                const words = parseInt(wordMatch[1]);
                setWordCount(words);
                // Track words processed during enhancement
                if (currentStage === "enhance") {
                  setWordsProcessed(words);
                }
              }

              // Extract chunk size from step message and accumulate
              const chunkSizeMatch = data.step.match(/(\d+\.?\d*)\s*MB/);
              if (chunkSizeMatch) {
                const sizeMB = parseFloat(chunkSizeMatch[1]);
                setChunkSize(`${sizeMB} MB`);

                // Accumulate audio size
                setAudioSizeAccumulated(prev => {
                  const newSize = prev + sizeMB;
                  setAudioSizeHistory(prevHistory => [...prevHistory, newSize]);
                  return newSize;
                });
              }

              // Track chunk start/completion for timing
              if (data.step.toLowerCase().includes("processing chunk")) {
                const chunkMatch = data.step.match(/chunk (\d+)/i);
                if (chunkMatch) {
                  const chunkNum = parseInt(chunkMatch[1]);

                  // Complete previous chunk if exists
                  if (currentChunkDetails) {
                    const chunkTime = (Date.now() - currentChunkDetails.startTime) / 1000;
                    setChunkTimings(prev => [...prev, chunkTime]);
                  }

                  // Start new chunk tracking
                  setCurrentChunkDetails({
                    index: chunkNum,
                    totalChars: 0, // Will be extracted if available in message
                    startTime: Date.now()
                  });
                }
              }

              // Update stage based on progress
              if (data.progress < 40) {
                setCurrentStage("enhance");
              } else if (data.progress < 75) {
                setCurrentStage("generate");
              } else if (data.progress < 100) {
                setCurrentStage("upload");
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
                  parallel: Math.min(batchSize, data.totalChunks - (data.completedChunks || 0))
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
                  setCurrentChunkDetails(prev => prev ? {
                    ...prev,
                    totalChars: data.chunkMetadata.characterCount
                  } : null);
                }

                if (data.chunkMetadata.batchNumber && data.chunkMetadata.totalBatches) {
                  setBatchInfo({
                    current: data.chunkMetadata.batchNumber,
                    total: data.chunkMetadata.totalBatches,
                    parallel: data.chunkMetadata.parallelChunks || 3
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
    startGeneration();
  };

  const handleDownload = async () => {
    if (!blobUrl) return;

    try {
      // Fetch the audio file
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `article-${articleId}-audio.mp3`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Audio downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download audio");
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.08),transparent_50%)]" />

      <div className="relative max-w-3xl w-full px-4 sm:px-6">
        <div className="bg-black/40 backdrop-blur-sm border border-gray-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12">
          <div className="space-y-8 sm:space-y-10">
            {/* Status Header */}
            <div className="text-center space-y-4 sm:space-y-6">
              {/* Status Icon */}
              <div className="flex justify-center relative">
                {error ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center">
                      <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" />
                    </div>
                  </div>
                ) : isComplete ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00ff88]/30 to-[#00d4ff]/30 rounded-full blur-2xl animate-pulse" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 border-2 border-[#00ff88] flex items-center justify-center">
                      <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#00ff88]" />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#00ff88]/20 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                      {/* Spinning outer ring */}
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00ff88] border-r-[#00d4ff] animate-spin" />
                      {/* Inner circle */}
                      <div className="absolute inset-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <div className="text-[#00ff88] font-bold text-lg">{progress}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Text */}
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                  {error ? "Generation Failed" : isComplete ? "Audio Ready!" : "Generating Audio"}
                </h2>
                <div className="flex items-center justify-center gap-2">
                  {!error && !isComplete && (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                  <p className="text-sm sm:text-base md:text-lg text-white/70">
                    {currentStep}
                  </p>
                </div>
              </div>
            </div>

            {/* Can Close Page Info Banner */}
            {canCloseInfo && !isComplete && !error && (
              <div className="relative group">
                <div className="absolute inset-0 bg-[#00d4ff]/10 rounded-xl blur-xl" />
                <div className="relative p-4 sm:p-5 border border-[#00d4ff]/30 rounded-xl bg-[#00d4ff]/5 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00d4ff]/20 flex items-center justify-center">
                      <span className="text-[#00d4ff] text-lg">ℹ️</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-[#00d4ff] font-semibold text-sm mb-1">Processing in Background</div>
                      <div className="text-white/60 text-xs leading-relaxed">
                        You can safely close this page. Come back anytime to check progress or find the completed audio in your library.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NEW: Time Metrics Cards */}
            {!error && !isComplete && startTime && (
              <TimeMetricsCards
                elapsedTime={elapsedTime}
                estimatedRemaining={estimatedTimeRemaining}
                wordsPerSecond={wordsPerSecond}
                chunksPerMinute={chunksPerMinute}
              />
            )}

            {/* NEW: Rich Stage Details Card */}
            {!error && !isComplete && (
              <StageDetailsCard
                currentStage={currentStage}
                progress={progress}
                currentStep={currentStep}
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
            )}

            {/* NEW: Audio Size Sparkline (only during generate stage) */}
            {!error && !isComplete && currentStage === "generate" && audioSizeHistory.length > 0 && (
              <AudioSizeSparkline
                audioSizeHistory={audioSizeHistory}
                currentSize={audioSizeAccumulated}
                estimatedTotal={estimatedTotalSize}
              />
            )}

            {/* Enhanced Progress Bar */}
            {!error && (
              <div className="space-y-4 sm:space-y-5">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-white/60 font-medium">Progress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00ff88] font-bold text-base sm:text-lg">{progress}%</span>
                  </div>
                </div>

                {/* Multi-layer progress bar */}
                <div className="relative">
                  {/* Background track */}
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    {/* Progress fill with gradient */}
                    <div
                      className="h-full bg-gradient-to-r from-[#00ff88] via-[#00d4ff] to-[#00ff88] rounded-full transition-all duration-500 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                  </div>

                  {/* Glow effect */}
                  {!isComplete && (
                    <div
                      className="absolute top-0 left-0 h-full bg-[#00ff88]/30 rounded-full blur-md transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>

                {/* Progress milestones */}
                {!isComplete && !error && (
                  <div className="flex justify-between text-xs text-white/40 px-1">
                    <span className={progress >= 10 ? "text-[#00ff88]" : ""}>Start</span>
                    <span className={progress >= 40 ? "text-[#00ff88]" : ""}>Processing</span>
                    <span className={progress >= 75 ? "text-[#00ff88]" : ""}>Finalizing</span>
                    <span className={progress >= 100 ? "text-[#00ff88]" : ""}>Done</span>
                  </div>
                )}

                {/* Stage Indicator */}
                {!isComplete && !error && (
                  <div className="mt-6 sm:mt-8">
                    <div className="flex items-center justify-between gap-2 sm:gap-4">
                      {/* Enhance Stage */}
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          currentStage === "enhance"
                            ? "border-[#00ff88] bg-[#00ff88]/20 shadow-lg shadow-[#00ff88]/30"
                            : progress >= 40
                            ? "border-[#00ff88] bg-[#00ff88]/10"
                            : "border-white/20 bg-white/5"
                        }`}>
                          {currentStage === "enhance" ? (
                            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                          ) : progress >= 40 ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#00ff88]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white/30" />
                          )}
                        </div>
                        <span className={`text-xs sm:text-sm font-medium transition-colors ${
                          currentStage === "enhance" || progress >= 40 ? "text-[#00ff88]" : "text-white/40"
                        }`}>
                          Enhance
                        </span>
                      </div>

                      {/* Connection Line */}
                      <div className="flex-1 h-0.5 bg-white/10 relative">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00ff88] to-[#00d4ff] transition-all duration-500"
                          style={{ width: progress >= 40 ? "100%" : "0%" }}
                        />
                      </div>

                      {/* Generate Stage */}
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          currentStage === "generate"
                            ? "border-[#00d4ff] bg-[#00d4ff]/20 shadow-lg shadow-[#00d4ff]/30"
                            : progress >= 75
                            ? "border-[#00d4ff] bg-[#00d4ff]/10"
                            : "border-white/20 bg-white/5"
                        }`}>
                          {currentStage === "generate" ? (
                            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
                          ) : progress >= 75 ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#00d4ff]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white/30" />
                          )}
                        </div>
                        <span className={`text-xs sm:text-sm font-medium transition-colors ${
                          currentStage === "generate" || progress >= 75 ? "text-[#00d4ff]" : "text-white/40"
                        }`}>
                          Generate
                        </span>
                      </div>

                      {/* Connection Line */}
                      <div className="flex-1 h-0.5 bg-white/10 relative">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00d4ff] to-[#00ff88] transition-all duration-500"
                          style={{ width: progress >= 75 ? "100%" : "0%" }}
                        />
                      </div>

                      {/* Upload Stage */}
                      <div className="flex-1 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          currentStage === "upload"
                            ? "border-[#00ff88] bg-[#00ff88]/20 shadow-lg shadow-[#00ff88]/30"
                            : progress >= 100
                            ? "border-[#00ff88] bg-[#00ff88]/10"
                            : "border-white/20 bg-white/5"
                        }`}>
                          {currentStage === "upload" ? (
                            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                          ) : progress >= 100 ? (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#00ff88]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-white/30" />
                          )}
                        </div>
                        <span className={`text-xs sm:text-sm font-medium transition-colors ${
                          currentStage === "upload" || progress >= 100 ? "text-[#00ff88]" : "text-white/40"
                        }`}>
                          Finalize
                        </span>
                      </div>
                    </div>

                    {/* Live Stats & Activity Log */}
                    {!isComplete && !error && (
                      <div className="mt-6 sm:mt-8 space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                          {/* Enhancement Progress */}
                          {(currentStage === "enhance" || progress >= 40) && (
                            <div className="relative p-4 rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/5 backdrop-blur-sm">
                              <div className="text-xs text-white/50 mb-1">Enhancement</div>
                              <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-bold text-[#00ff88]">
                                  {currentStage === "enhance" && wordCount > 0 ? wordCount : "✓"}
                                </div>
                                {currentStage === "enhance" && wordCount > 0 && (
                                  <div className="text-sm text-white/50">words</div>
                                )}
                              </div>
                              {currentStage === "enhance" && progress > 10 && (
                                <div className="mt-2 text-xs text-[#00ff88]/70">
                                  {Math.round(((progress - 10) / 30) * 100)}% complete
                                </div>
                              )}
                            </div>
                          )}

                          {/* Audio Chunks */}
                          {(currentStage === "generate" || progress >= 75) && totalChunks > 0 && (
                            <div className="relative p-4 rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 backdrop-blur-sm">
                              <div className="text-xs text-white/50 mb-1">Audio Parts</div>
                              <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-bold text-[#00d4ff]">
                                  {completedChunks}
                                </div>
                                <div className="text-sm text-white/50">/ {totalChunks}</div>
                              </div>
                              {currentStage === "generate" && totalChunks > 0 && (
                                <div className="mt-2 text-xs text-[#00d4ff]/70">
                                  {Math.round((completedChunks / totalChunks) * 100)}% generated
                                </div>
                              )}
                              {chunkSize && (
                                <div className="mt-1 text-xs text-white/40">{chunkSize} each</div>
                              )}
                            </div>
                          )}

                          {/* Upload Progress */}
                          {currentStage === "upload" && (
                            <div className="relative p-4 rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/5 backdrop-blur-sm">
                              <div className="text-xs text-white/50 mb-1">Upload</div>
                              <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-bold text-[#00ff88]">
                                  {progress >= 95 ? "✓" : Math.round(((progress - 75) / 20) * 100) + "%"}
                                </div>
                              </div>
                              {chunkSize && (
                                <div className="mt-2 text-xs text-white/40">
                                  Finalizing {chunkSize}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Live Activity Log */}
                        {activityLog.length > 0 && (
                          <div className="relative p-4 sm:p-5 rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                              <span className="text-xs sm:text-sm text-white/60 font-medium">Live Activity</span>
                            </div>
                            <div className="space-y-2">
                              {activityLog.map((log, i) => (
                                <div
                                  key={i}
                                  className="text-xs sm:text-sm text-white/70 font-mono pl-4 border-l-2 border-[#00ff88]/30 animate-in fade-in-0 slide-in-from-left-2 duration-300"
                                  style={{ animationDelay: `${i * 50}ms` }}
                                >
                                  {log}
                                </div>
                              ))}
                            </div>
                            {/* Terminal-style scan line effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00ff88]/5 to-transparent pointer-events-none animate-pulse" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chunk Progress Indicator */}
                    {totalChunks > 1 && currentStage === "generate" && (
                      <div className="mt-6 sm:mt-8">
                        <div className="relative p-4 sm:p-5 rounded-xl border border-[#00d4ff]/30 bg-[#00d4ff]/5 backdrop-blur-sm">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs sm:text-sm text-white/60 font-medium">Audio Parts</span>
                            <span className="text-sm sm:text-base text-[#00d4ff] font-bold">
                              {completedChunks} / {totalChunks}
                            </span>
                          </div>
                          <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
                            {Array.from({ length: totalChunks }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  i < completedChunks
                                    ? "bg-[#00d4ff] shadow-sm shadow-[#00d4ff]/50"
                                    : "bg-white/10"
                                }`}
                              />
                            ))}
                          </div>
                          {totalChunks > 10 && (
                            <div className="mt-2 text-center text-xs text-white/40">
                              Processing in parallel batches
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* NEW: Detailed Stats Table */}
                {!isComplete && !error && totalChunks > 0 && startTime && (
                  <DetailedStatsTable
                    wordCount={wordCount}
                    wordsProcessed={wordsProcessed}
                    totalChunks={totalChunks}
                    completedChunks={completedChunks}
                    chunkTimings={chunkTimings}
                    voiceId={voiceId || undefined}
                    voiceName={voiceId ? "Selected Voice" : undefined}
                    modelInfo="eleven_turbo_v2_5 (ElevenLabs v3)"
                    estimatedDuration={estimatedAudioDuration}
                    estimatedTotalSize={estimatedTotalSize}
                  />
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="relative group">
                <div className="absolute inset-0 bg-red-500/10 rounded-xl sm:rounded-2xl blur-xl" />
                <div className="relative p-5 sm:p-7 border-2 border-red-500/30 rounded-xl sm:rounded-2xl bg-red-500/5 backdrop-blur-sm">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                      <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-red-300 font-semibold text-sm sm:text-base">Generation Failed</div>
                      <div className="text-red-400/80 text-xs sm:text-sm leading-relaxed">{error}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {isComplete && blobUrl && (
              <div className="space-y-5 sm:space-y-7">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 rounded-xl sm:rounded-2xl blur-xl animate-pulse" />
                  <div className="relative p-5 sm:p-7 border-2 border-[#00ff88]/30 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#00ff88]/5 to-[#00d4ff]/5 backdrop-blur-sm">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#00ff88]" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-[#00ff88] font-bold text-base sm:text-lg">Audio Generated Successfully!</div>
                        <div className="text-white/60 text-xs sm:text-sm">Your audio is ready to play. Enjoy listening!</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Button
                    onClick={handlePlayAudio}
                    size="lg"
                    className="relative overflow-hidden group bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black hover:opacity-90 h-14 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-[#00ff88]/25 transition-all hover:shadow-xl hover:shadow-[#00ff88]/40 hover:-translate-y-0.5"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="black" />
                    <span className="relative">Play Audio</span>
                  </Button>
                  <Button
                    onClick={handleDownload}
                    size="lg"
                    className="relative overflow-hidden group bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white hover:opacity-90 h-14 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-[#00d4ff]/25 transition-all hover:shadow-xl hover:shadow-[#00d4ff]/40 hover:-translate-y-0.5"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <Download className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    <span className="relative">Download</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => router.push("/")}
                    className="border-2 border-white/20 bg-white/5 text-white hover:text-white hover:bg-white/10 hover:border-white/30 h-14 sm:h-16 rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg transition-all"
                  >
                    <Home className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    Home
                  </Button>
                </div>
              </div>
            )}

            {/* Retry Section */}
            {error && !isComplete && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button
                  onClick={handleRetry}
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:opacity-90 h-14 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                  Retry Generation
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/")}
                  className="border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 h-14 sm:h-16 rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg transition-all"
                >
                  <Home className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                  Home
                </Button>
              </div>
            )}

            {/* Info Footer */}
            {!isComplete && !error && (
              <div className="relative">
                <div className="absolute inset-0 bg-white/5 rounded-xl blur-xl" />
                <div className="relative p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-white/50">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                      <span>Processing your article</span>
                    </div>
                    <div className="hidden sm:block w-px h-4 bg-white/20" />
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" style={{ animationDelay: "500ms" }} />
                      <span>Keep this page open</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
