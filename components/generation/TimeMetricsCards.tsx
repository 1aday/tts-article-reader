import { Clock3, TimerReset, Zap } from "lucide-react";

interface TimeMetricsCardsProps {
  elapsedTime: number; // seconds
  estimatedRemaining: number; // seconds
  wordsPerSecond: number;
  chunksPerMinute: number;
  completedChunks: number;
  totalChunks: number;
  isComplete?: boolean;
}

export function TimeMetricsCards({
  elapsedTime,
  estimatedRemaining,
  wordsPerSecond,
  chunksPerMinute,
  completedChunks,
  totalChunks,
  isComplete = false,
}: TimeMetricsCardsProps) {
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "0m 0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const safeRemaining = Math.max(0, estimatedRemaining);
  const estimatedTotal = elapsedTime + safeRemaining;
  const hasChunkProgress = totalChunks > 0;
  const chunkProgress = hasChunkProgress ? Math.min(Math.max(completedChunks, 0) / totalChunks, 1) : 0;
  const estimatedProgress = estimatedTotal > 0 ? Math.min(elapsedTime / estimatedTotal, 1) : 0;

  let liveProgress = hasChunkProgress ? Math.max(chunkProgress, estimatedProgress) : estimatedProgress;
  if (estimatedTotal === 0 && !hasChunkProgress) {
    liveProgress = 0;
  }
  if (isComplete) {
    liveProgress = 1;
  }

  const progressPercent = Math.round(liveProgress * 100);
  const speedValue = wordsPerSecond > 0 ? `${wordsPerSecond} w/s` : `${chunksPerMinute.toFixed(1)} c/m`;
  const speedFill = Math.min(
    wordsPerSecond > 0 ? wordsPerSecond / 4 : chunksPerMinute / 2,
    1
  );

  const cards = [
    {
      label: "Elapsed",
      value: formatTime(elapsedTime),
      helper: "Live processing session",
      Icon: Clock3,
      accent: "from-[#e50914]/24 via-[#e50914]/10 to-transparent",
      ring: "border-[#e50914]/35 text-[#ff5a64]",
      fill: liveProgress,
    },
    {
      label: "Remaining",
      value: formatTime(estimatedRemaining),
      helper: "Estimated from current throughput",
      Icon: TimerReset,
      accent: "from-[#ff4552]/20 via-[#e50914]/8 to-transparent",
      ring: "border-[#ff4552]/30 text-[#ff5d67]",
      fill: 1 - liveProgress,
    },
    {
      label: "Speed",
      value: speedValue,
      helper: wordsPerSecond > 0 ? "Words per second" : "Chunks per minute",
      Icon: Zap,
      accent: "from-[#e50914]/30 via-[#f40612]/12 to-transparent",
      ring: "border-[#f40612]/35 text-[#ff525d]",
      fill: speedFill,
    },
  ];

  return (
    <div className="mb-8 space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-[#e50914]/30 bg-[linear-gradient(145deg,rgba(229,9,20,0.14),rgba(8,10,16,0.9))] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.34)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(255,255,255,0.12),transparent_38%)]" />
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em]">
            <span className="text-white/60">Live ETA Progress</span>
            <span className="font-semibold text-[#ff5a64]">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-white/12 bg-black/35">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-[#e50914] via-[#ff3b47] to-[#ff8b93] transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-white/30" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/65">
            <span>{formatTime(elapsedTime)} elapsed</span>
            <span className="h-3 w-px bg-white/25" />
            <span>{formatTime(safeRemaining)} remaining</span>
            <span className="h-3 w-px bg-white/25" />
            <span>{speedValue}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, helper, Icon, accent, ring, fill }) => (
          <article
            key={label}
            className="group relative overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(13,17,26,0.92),rgba(8,10,16,0.88))] p-5 shadow-[0_16px_44px_rgba(0,0,0,0.34)] transition-all hover:-translate-y-0.5 hover:border-white/20"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-80`} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">{label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border bg-black/25 ${ring}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <div className="mb-2 text-3xl font-semibold leading-none text-white">
                {value}
              </div>
              <div className="text-xs text-white/50">{helper}</div>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#e50914] to-[#ff404d] transition-all duration-700"
                  style={{ width: `${Math.round(Math.max(0, Math.min(fill, 1)) * 100)}%` }}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
