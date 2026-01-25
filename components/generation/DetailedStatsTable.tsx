"use client";

import { useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";

interface DetailedStatsTableProps {
  // Text stats
  wordCount: number;
  wordsProcessed: number;

  // Audio stats
  totalChunks: number;
  completedChunks: number;
  chunkTimings: number[]; // seconds per chunk

  // API stats
  voiceId?: string;
  voiceName?: string;
  modelInfo?: string;

  // Estimates
  estimatedDuration: number; // minutes
  estimatedTotalSize: number; // MB
}

export function DetailedStatsTable({
  wordCount,
  wordsProcessed,
  totalChunks,
  completedChunks,
  chunkTimings,
  voiceId,
  voiceName,
  modelInfo,
  estimatedDuration,
  estimatedTotalSize
}: DetailedStatsTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const avgChunkTime =
    chunkTimings.length > 0
      ? chunkTimings.reduce((a, b) => a + b, 0) / chunkTimings.length
      : 0;

  const minChunkTime = chunkTimings.length > 0 ? Math.min(...chunkTimings) : 0;
  const maxChunkTime = chunkTimings.length > 0 ? Math.max(...chunkTimings) : 0;

  return (
    <div className="bg-surface-2 border-2 border-white/10 rounded-xl overflow-hidden mb-8">
      {/* Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#a855f7]" />
          <span className="font-semibold text-white">Detailed Statistics</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/60 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-3 animate-fadeInDown">
          <StatRow
            label="Text Enhanced"
            value={`${wordsProcessed.toLocaleString()} / ${wordCount.toLocaleString()} words`}
            percentage={wordCount > 0 ? (wordsProcessed / wordCount) * 100 : 0}
            color="green"
          />
          <StatRow
            label="Audio Chunks"
            value={`${completedChunks} / ${totalChunks} complete`}
            percentage={totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0}
            color="cyan"
          />
          {avgChunkTime > 0 && (
            <StatRow
              label="Average Chunk Time"
              value={`${avgChunkTime.toFixed(1)} seconds`}
              sublabel={
                minChunkTime > 0 && maxChunkTime > 0
                  ? `Fastest: ${minChunkTime.toFixed(1)}s | Slowest: ${maxChunkTime.toFixed(1)}s`
                  : undefined
              }
            />
          )}
          <StatRow
            label="Total API Calls"
            value={`${completedChunks} calls`}
            sublabel="Batched in groups of 3 (rate limit optimization)"
          />
          {voiceName && (
            <StatRow
              label="Voice Model"
              value={voiceName}
              sublabel={
                voiceId
                  ? `${modelInfo || "eleven_turbo_v2_5"} • Voice ID: ${voiceId.slice(0, 8)}...`
                  : modelInfo || "eleven_turbo_v2_5"
              }
            />
          )}
          {estimatedDuration > 0 && (
            <StatRow
              label="Estimated Final Duration"
              value={`~${estimatedDuration.toFixed(1)} minutes`}
              sublabel={`Based on ${estimatedTotalSize.toFixed(1)} MB at 128 kbps`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  percentage,
  sublabel,
  color = "gray"
}: {
  label: string;
  value: string;
  percentage?: number;
  sublabel?: string;
  color?: "green" | "cyan" | "purple" | "gray";
}) {
  const colorMap = {
    green: "from-[#00ff88] to-[#00d4ff]",
    cyan: "from-[#00d4ff] to-[#a855f7]",
    purple: "from-[#a855f7] to-[#ff00ff]",
    gray: "from-white/20 to-white/10"
  };

  return (
    <div className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <div className="text-sm text-white/60 mb-1">{label}</div>
        {percentage !== undefined && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colorMap[color]} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-xs text-white/40 min-w-[40px] text-right">
              {percentage.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
      <div className="ml-6 text-right">
        <div className="text-base font-semibold text-white">{value}</div>
        {sublabel && <div className="text-xs text-white/40 mt-1">{sublabel}</div>}
      </div>
    </div>
  );
}
