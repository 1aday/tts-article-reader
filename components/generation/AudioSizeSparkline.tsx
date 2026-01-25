import { HardDrive } from "lucide-react";

interface AudioSizeSparklineProps {
  audioSizeHistory: number[]; // array of sizes in MB
  currentSize: number;
  estimatedTotal: number;
}

export function AudioSizeSparkline({
  audioSizeHistory,
  currentSize,
  estimatedTotal
}: AudioSizeSparklineProps) {
  const maxSize = Math.max(estimatedTotal, ...audioSizeHistory);
  const dataPoints = audioSizeHistory.slice(-20); // last 20 data points

  return (
    <div className="bg-surface-2 border-2 border-white/10 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-[#00d4ff]" />
          <span className="text-sm font-semibold text-white">Audio File Size</span>
        </div>
        <div className="text-2xl font-bold gradient-terminal">
          {currentSize.toFixed(1)} MB
        </div>
      </div>

      {/* Sparkline visualization */}
      <div className="relative h-16 flex items-end gap-1">
        {dataPoints.map((size, idx) => {
          const height = maxSize > 0 ? (size / maxSize) * 100 : 0;
          const isLast = idx === dataPoints.length - 1;

          return (
            <div
              key={idx}
              className={`flex-1 rounded-t transition-all duration-300 ${
                isLast
                  ? "bg-gradient-to-t from-[#00ff88] to-[#00d4ff] animate-pulse"
                  : "bg-gradient-to-t from-[#00ff88]/60 to-[#00d4ff]/60"
              }`}
              style={{ height: `${height}%` }}
            />
          );
        })}

        {/* Estimated remaining (ghost bars) */}
        {currentSize < estimatedTotal &&
          Array.from({ length: Math.min(10, 20 - dataPoints.length) }).map((_, idx) => (
            <div
              key={`ghost-${idx}`}
              className="flex-1 bg-white/5 rounded-t"
              style={{ height: "50%" }}
            />
          ))}
      </div>

      {/* Size labels */}
      <div className="flex items-center justify-between mt-3 text-xs text-white/50">
        <span>0 MB</span>
        <span className="text-[#00d4ff]">~{estimatedTotal.toFixed(1)} MB estimated</span>
      </div>
    </div>
  );
}
