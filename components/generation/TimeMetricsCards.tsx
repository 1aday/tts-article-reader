import { Clock, Timer, Zap } from "lucide-react";

interface TimeMetricsCardsProps {
  elapsedTime: number; // seconds
  estimatedRemaining: number; // seconds
  wordsPerSecond: number;
  chunksPerMinute: number;
}

export function TimeMetricsCards({
  elapsedTime,
  estimatedRemaining,
  wordsPerSecond,
  chunksPerMinute
}: TimeMetricsCardsProps) {
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "0m 0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStartTime = () => {
    const startDate = new Date(Date.now() - elapsedTime * 1000);
    return startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCompletionTime = () => {
    const completionDate = new Date(Date.now() + estimatedRemaining * 1000);
    return completionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {/* Elapsed Time Card */}
      <div className="bg-surface-2 border-2 border-[#e50914]/20 rounded-xl p-6 relative overflow-hidden group hover:border-[#e50914]/40 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e50914]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[#e50914]" />
            <span className="text-xs text-white/60 uppercase tracking-wide">Elapsed</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {formatTime(elapsedTime)}
          </div>
          <div className="text-xs text-white/50">
            Started at {getStartTime()}
          </div>
        </div>
      </div>

      {/* Estimated Remaining Card */}
      <div className="bg-surface-2 border-2 border-[#e50914]/20 rounded-xl p-6 relative overflow-hidden group hover:border-[#e50914]/40 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e50914]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-[#e50914]" />
            <span className="text-xs text-white/60 uppercase tracking-wide">Remaining</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {formatTime(estimatedRemaining)}
          </div>
          <div className="text-xs text-white/50">
            Est. completion: {getCompletionTime()}
          </div>
        </div>
      </div>

      {/* Processing Speed Card */}
      <div className="bg-surface-2 border-2 border-[#a855f7]/20 rounded-xl p-6 relative overflow-hidden group hover:border-[#a855f7]/40 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#a855f7]" />
            <span className="text-xs text-white/60 uppercase tracking-wide">Speed</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {wordsPerSecond > 0 ? `${wordsPerSecond} w/s` : `${chunksPerMinute.toFixed(1)} c/m`}
          </div>
          <div className="text-xs text-white/50">
            {wordsPerSecond > 0 ? "Words per second" : "Chunks per minute"}
          </div>
        </div>
      </div>
    </div>
  );
}
