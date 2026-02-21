import { Sparkles, Volume2, Upload, CheckCircle, FileText, Zap, HardDrive, Layers } from "lucide-react";

type EnhancementState = "pending" | "running" | "reused" | "completed" | "skipped";

interface StageDetailsCardProps {
  currentStage: "enhance" | "generate" | "upload" | "complete";
  progress: number;
  currentStep: string;
  enhancementEnabled: boolean;
  enhancementState: EnhancementState;

  // Stage-specific data
  wordCount?: number;
  wordsProcessed?: number;
  totalChunks?: number;
  completedChunks?: number;
  currentChunkIndex?: number;
  currentChunkChars?: number;
  audioSizeAccumulated?: number;
  estimatedTotalSize?: number;
  batchInfo?: {
    current: number;
    total: number;
    parallel: number;
  };
}

export function StageDetailsCard({
  currentStage,
  progress,
  currentStep,
  enhancementEnabled,
  enhancementState,
  wordCount,
  wordsProcessed,
  totalChunks,
  completedChunks,
  currentChunkIndex,
  currentChunkChars,
  audioSizeAccumulated,
  estimatedTotalSize,
  batchInfo
}: StageDetailsCardProps) {
  const enhancementCompletionPercent =
    wordCount && wordsProcessed !== undefined
      ? Math.min(100, Math.round((wordsProcessed / wordCount) * 100))
      : 0;
  const enhancementModeValue = !enhancementEnabled
    ? "Skipped (optional)"
    : enhancementState === "reused"
    ? "Using saved enhanced text"
    : enhancementState === "completed"
    ? "Completed"
    : enhancementState === "running"
    ? "Running now"
    : "Queued";
  const enhancementModeDetail = enhancementEnabled
    ? "OpenAI GPT-5 nano punctuation and pacing pass"
    : "Original article text is used directly";
  const scriptSourceValue = !enhancementEnabled
    ? "Original article text"
    : enhancementState === "reused"
    ? "Saved AI-enhanced text"
    : "AI-enhanced text";
  const scriptSourceDetail = enhancementEnabled
    ? "Optional enhancement enabled for this run"
    : "Optional enhancement was skipped";

  const getStageIcon = () => {
    switch (currentStage) {
      case "enhance":
        return <Sparkles className="w-5 h-5 text-[#e50914]" />;
      case "generate":
        return <Volume2 className="w-5 h-5 text-[#e50914]" />;
      case "upload":
        return <Upload className="w-5 h-5 text-[#f40612]" />;
      case "complete":
        return <CheckCircle className="w-5 h-5 text-[#e50914]" />;
    }
  };

  const stageLabel =
    currentStage === "enhance"
      ? "Enhancement"
      : currentStage === "generate"
      ? "Generation"
      : currentStage === "upload"
      ? "Finalize"
      : "Ready";

  return (
    <section className="mb-8 rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(13,17,26,0.92),rgba(8,10,16,0.88))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.38)] sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#e50914]/35 bg-[linear-gradient(145deg,rgba(229,9,20,0.2),rgba(12,16,24,0.9))] shadow-[0_10px_26px_rgba(229,9,20,0.18)]">
          {getStageIcon()}
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{stageLabel}</p>
          <h3 className="text-xl font-semibold text-white sm:text-2xl">{currentStep}</h3>
          {currentStage === "generate" && totalChunks && (
            <p className="mt-1 text-sm text-white/58">
              Chunk {currentChunkIndex} of {totalChunks}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[#e50914]/35 bg-[#e50914]/12 px-3 py-2 text-right shadow-[0_8px_22px_rgba(229,9,20,0.2)]">
          <div className="text-2xl font-semibold text-[#ff5862] sm:text-3xl">
            {progress}%
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">Progress</div>
        </div>
      </div>

      <div className="relative mb-6 h-3 overflow-hidden rounded-full border border-white/10 bg-white/8">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#e50914] via-[#ff2e3b] to-[#b20710] shadow-[0_0_18px_rgba(229,9,20,0.5)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-white/0 via-white/30 to-white/0" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {currentStage === "enhance" && (
          <>
            <DetailItem
              icon={<Zap className="w-4 h-4" />}
              label="Enhancement Mode"
              value={enhancementModeValue}
              sublabel={enhancementModeDetail}
            />
            {enhancementEnabled && wordCount && wordsProcessed !== undefined ? (
              <DetailItem
                icon={<FileText className="w-4 h-4" />}
                label="Words Processed"
                value={`${wordsProcessed.toLocaleString()} / ${wordCount.toLocaleString()}`}
                sublabel={`${enhancementCompletionPercent}% complete`}
              />
            ) : (
              <DetailItem
                icon={<FileText className="w-4 h-4" />}
                label="Source Text"
                value={typeof wordCount === "number" && wordCount > 0 ? `${wordCount.toLocaleString()} words` : "Preparing text"}
                sublabel="Ready for speech generation"
              />
            )}
          </>
        )}

        {currentStage === "generate" && totalChunks && (
          <>
            <DetailItem
              icon={<Sparkles className="w-4 h-4" />}
              label="Script Source"
              value={scriptSourceValue}
              sublabel={scriptSourceDetail}
            />
            {currentChunkChars && (
              <DetailItem
                icon={<FileText className="w-4 h-4" />}
                label="Current Chunk"
                value={`${currentChunkChars.toLocaleString()} chars`}
                sublabel={`Part ${currentChunkIndex} of ${totalChunks}`}
              />
            )}
            {audioSizeAccumulated !== undefined && (
              <DetailItem
                icon={<HardDrive className="w-4 h-4" />}
                label="Audio Generated"
                value={`${audioSizeAccumulated.toFixed(1)} MB`}
                sublabel={estimatedTotalSize ? `~${estimatedTotalSize.toFixed(1)} MB estimated` : undefined}
              />
            )}
            {batchInfo && (
              <DetailItem
                icon={<Layers className="w-4 h-4" />}
                label="Batch Processing"
                value={`Batch ${batchInfo.current} of ${batchInfo.total}`}
                sublabel={`${batchInfo.parallel} chunks in parallel`}
              />
            )}
            <DetailItem
              icon={<CheckCircle className="w-4 h-4" />}
              label="Chunks Complete"
              value={`${completedChunks} / ${totalChunks}`}
              sublabel={
                <div className="mt-1 flex items-center gap-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-[#e50914] to-[#b20710]"
                      style={{ width: `${((completedChunks || 0) / totalChunks) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs">{Math.round(((completedChunks || 0) / totalChunks) * 100)}%</span>
                </div>
              }
            />
          </>
        )}

        {currentStage === "upload" && (
          <>
            <DetailItem
              icon={<Upload className="w-4 h-4" />}
              label="Upload Status"
              value="Finalizing..."
              sublabel="Saving to cloud storage"
            />
            {audioSizeAccumulated !== undefined && (
              <DetailItem
                icon={<HardDrive className="w-4 h-4" />}
                label="Final File Size"
                value={`${audioSizeAccumulated.toFixed(1)} MB`}
                sublabel="Compressed MP3"
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

// Helper component
function DetailItem({
  icon,
  label,
  value,
  sublabel
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/12 bg-[linear-gradient(150deg,rgba(255,255,255,0.03),rgba(6,8,12,0.35))] p-4">
      <div className="rounded-lg border border-[#e50914]/25 bg-[#e50914]/12 p-2 text-[#ff5862]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
        <div className="truncate text-base font-semibold text-white">{value}</div>
        {sublabel && (
          <div className="mt-1 text-xs text-white/45">
            {typeof sublabel === 'string' ? sublabel : sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
