import { Sparkles, Volume2, Upload, CheckCircle, FileText, Zap, HardDrive, Layers } from "lucide-react";

interface StageDetailsCardProps {
  currentStage: "enhance" | "generate" | "upload" | "complete";
  progress: number;
  currentStep: string;

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
  const getStageIcon = () => {
    switch (currentStage) {
      case "enhance":
        return <Sparkles className="w-5 h-5 text-[#00ff88]" />;
      case "generate":
        return <Volume2 className="w-5 h-5 text-[#00d4ff]" />;
      case "upload":
        return <Upload className="w-5 h-5 text-[#a855f7]" />;
      case "complete":
        return <CheckCircle className="w-5 h-5 text-[#00ff88]" />;
    }
  };

  return (
    <div className="bg-gradient-to-br from-surface-1 to-surface-2 border-2 border-white/10 rounded-2xl p-8 mb-8 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#00ff88]/20 to-[#00d4ff]/20 border border-[#00ff88]/30">
          {getStageIcon()}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">{currentStep}</h3>
          {currentStage === "generate" && totalChunks && (
            <p className="text-sm text-white/60">
              Chunk {currentChunkIndex} of {totalChunks}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold gradient-terminal">
            {progress}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-surface-3 rounded-full overflow-hidden mb-6">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer" />
        </div>
      </div>

      {/* Stage-Specific Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currentStage === "enhance" && wordCount && wordsProcessed !== undefined && (
          <>
            <DetailItem
              icon={<FileText className="w-4 h-4" />}
              label="Words Processed"
              value={`${wordsProcessed.toLocaleString()} / ${wordCount.toLocaleString()}`}
              sublabel={`${Math.round((wordsProcessed / wordCount) * 100)}% complete`}
            />
            <DetailItem
              icon={<Zap className="w-4 h-4" />}
              label="Enhancement Type"
              value="AI Optimization"
              sublabel="OpenAI GPT-5 nano"
            />
          </>
        )}

        {currentStage === "generate" && totalChunks && (
          <>
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
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00ff88] to-[#00d4ff]"
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
    </div>
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
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-3/50 border border-white/5">
      <div className="p-2 rounded-lg bg-gradient-to-br from-[#00ff88]/10 to-[#00d4ff]/10 text-[#00ff88]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-1">{label}</div>
        <div className="text-base font-semibold text-white truncate">{value}</div>
        {sublabel && (
          <div className="text-xs text-white/40 mt-1">
            {typeof sublabel === 'string' ? sublabel : sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
