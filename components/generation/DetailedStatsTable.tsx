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
  const chunksPct = totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0;
  const wordsPct = wordCount > 0 ? Math.round((wordsProcessed / wordCount) * 100) : 0;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(13,17,26,0.9),rgba(8,10,16,0.88))] shadow-[0_14px_40px_rgba(0,0,0,0.34)]">
      {/* Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 transition-colors hover:bg-white/5 sm:px-6"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e50914]/35 bg-[#e50914]/12">
            <BarChart3 className="h-4 w-4 text-[#ff5862]" />
          </span>
          <div>
            <div className="font-semibold text-white">Detailed Statistics</div>
            <div className="text-[11px] text-white/45">
              {completedChunks}/{totalChunks} chunks · {chunksPct}% complete
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-white/12 bg-white/5 px-2 py-1 text-[11px] text-white/60 sm:inline-flex">
            {wordsPct}% text
          </span>
          <ChevronDown
            className={`h-5 w-5 text-white/60 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="animate-fadeInDown space-y-3 border-t border-white/10 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
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
                  ? `${modelInfo || "eleven_v3"} • Voice ID: ${voiceId.slice(0, 8)}...`
                  : modelInfo || "eleven_v3"
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
    </section>
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
    green: "from-[#e50914] to-[#b20710]",
    cyan: "from-[#e50914] to-[#f40612]",
    purple: "from-[#b20710] to-[#e50914]",
    gray: "from-white/20 to-white/10"
  };
  const boundedPercentage =
    percentage !== undefined ? Math.max(0, Math.min(100, percentage)) : undefined;

  return (
    <div className="flex items-start justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-3 last:mb-0">
      <div className="flex-1">
        <div className="mb-1 text-sm text-white/62">{label}</div>
        {percentage !== undefined && (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full bg-gradient-to-r ${colorMap[color]} transition-all duration-500`}
                style={{ width: `${boundedPercentage}%` }}
              />
            </div>
            <span className="text-xs text-white/40 min-w-[40px] text-right">
              {boundedPercentage?.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
      <div className="ml-4 text-right sm:ml-6">
        <div className="text-base font-semibold text-white">{value}</div>
        {sublabel && <div className="text-xs text-white/40 mt-1">{sublabel}</div>}
      </div>
    </div>
  );
}
