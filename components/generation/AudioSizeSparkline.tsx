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
    <section className="mb-8 rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(13,17,26,0.9),rgba(8,10,16,0.88))] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.32)] sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e50914]/35 bg-[#e50914]/12">
            <HardDrive className="h-4 w-4 text-[#ff5a64]" />
          </span>
          <span className="text-sm font-semibold text-white">Audio File Size</span>
        </div>
        <div className="rounded-lg border border-[#e50914]/30 bg-[#e50914]/10 px-3 py-1.5 text-xl font-semibold text-[#ff5862] sm:text-2xl">
          {currentSize.toFixed(1)} MB
        </div>
      </div>

      {/* Sparkline visualization */}
      <div className="relative flex h-20 items-end gap-1 overflow-hidden rounded-xl border border-white/10 bg-black/25 p-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-1/3 h-px bg-white/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-2/3 h-px bg-white/10" />
        {dataPoints.map((size, idx) => {
          const height = maxSize > 0 ? (size / maxSize) * 100 : 0;
          const isLast = idx === dataPoints.length - 1;

          return (
            <div
              key={idx}
              className={`flex-1 rounded-t transition-all duration-300 ${
                isLast
                  ? "bg-gradient-to-t from-[#e50914] to-[#ff3f4b] shadow-[0_0_14px_rgba(229,9,20,0.45)] animate-pulse"
                  : "bg-gradient-to-t from-[#e50914]/70 to-[#b20710]/65"
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
              className="flex-1 rounded-t bg-white/8"
              style={{ height: "50%" }}
            />
          ))}
      </div>

      {/* Size labels */}
      <div className="mt-3 flex items-center justify-between text-xs text-white/50">
        <span>0 MB</span>
        <span className="text-[#ff4b56]">~{estimatedTotal.toFixed(1)} MB estimated</span>
      </div>
    </section>
  );
}
