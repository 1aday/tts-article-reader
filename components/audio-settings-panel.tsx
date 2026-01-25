"use client";

import { cn } from "@/lib/utils";

interface AudioSettingsPanelProps {
  stability: number;
  onStabilityChange: (value: number) => void;
  similarityBoost: number;
  onSimilarityBoostChange: (value: number) => void;
  style: number;
  onStyleChange: (value: number) => void;
  useSpeakerBoost: boolean;
  onUseSpeakerBoostChange: (value: boolean) => void;
  className?: string;
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  tooltip,
}: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#e50914]">
          {label}
        </label>
        <span className="text-sm font-mono text-[--terminal-cyan]">
          {value.toFixed(2)}
        </span>
      </div>
      {tooltip && (
        <p className="text-xs text-gray-400 mb-1">{tooltip}</p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-[#0a0a0a] rounded-lg appearance-none cursor-pointer slider-thumb"
      />
    </div>
  );
}

export function AudioSettingsPanel({
  stability,
  onStabilityChange,
  similarityBoost,
  onSimilarityBoostChange,
  style,
  onStyleChange,
  useSpeakerBoost,
  onUseSpeakerBoostChange,
  className,
}: AudioSettingsPanelProps) {
  const handleReset = () => {
    onStabilityChange(0.5);
    onSimilarityBoostChange(0.75);
    onStyleChange(0);
    onUseSpeakerBoostChange(true);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#e50914]">
          Voice Settings
        </h3>
        <button
          onClick={handleReset}
          className="text-sm text-[--terminal-cyan] hover:text-[--terminal-cyan]/80 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Sliders */}
      <div className="space-y-5">
        <Slider
          label="Stability"
          value={stability}
          onChange={onStabilityChange}
          tooltip="Controls voice consistency. Lower values add more variation, higher values make it more stable."
        />

        <Slider
          label="Similarity Boost"
          value={similarityBoost}
          onChange={onSimilarityBoostChange}
          tooltip="Enhances similarity to the original voice. Higher values make it sound more like the training data."
        />

        <Slider
          label="Style"
          value={style}
          onChange={onStyleChange}
          tooltip="Adjusts the expressive range. Higher values increase emotional variation."
        />
      </div>

      {/* Speaker Boost Toggle */}
      <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg border border-[#00ff4133]">
        <div className="flex-1">
          <label className="text-sm font-medium text-[#e50914] block mb-1">
            Speaker Boost
          </label>
          <p className="text-xs text-gray-400">
            Enhances voice clarity and presence for better audio quality.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUseSpeakerBoostChange(!useSpeakerBoost)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4",
            useSpeakerBoost ? "bg-[--terminal-cyan]" : "bg-[--color-border]"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              useSpeakerBoost ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#e50914]">
          Quick Presets
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              onStabilityChange(0.4);
              onSimilarityBoostChange(0.7);
              onStyleChange(0.3);
              onUseSpeakerBoostChange(true);
            }}
            className="px-3 py-2 text-sm bg-[#0a0a0a] border border-[#00ff4133] rounded-md hover:border-[--terminal-cyan] hover:text-[--terminal-cyan] transition-colors"
          >
            Expressive
          </button>
          <button
            onClick={() => {
              onStabilityChange(0.7);
              onSimilarityBoostChange(0.8);
              onStyleChange(0.1);
              onUseSpeakerBoostChange(true);
            }}
            className="px-3 py-2 text-sm bg-[#0a0a0a] border border-[#00ff4133] rounded-md hover:border-[--terminal-cyan] hover:text-[--terminal-cyan] transition-colors"
          >
            Stable
          </button>
          <button
            onClick={() => {
              onStabilityChange(0.5);
              onSimilarityBoostChange(0.75);
              onStyleChange(0);
              onUseSpeakerBoostChange(true);
            }}
            className="px-3 py-2 text-sm bg-[#0a0a0a] border border-[#00ff4133] rounded-md hover:border-[--terminal-cyan] hover:text-[--terminal-cyan] transition-colors"
          >
            Balanced
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: var(--terminal-cyan);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
        }

        .slider-thumb::-moz-range-thumb {
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: var(--terminal-cyan);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
        }

        .slider-thumb::-webkit-slider-track {
          height: 0.5rem;
          border-radius: 0.25rem;
        }

        .slider-thumb::-moz-range-track {
          height: 0.5rem;
          border-radius: 0.25rem;
        }
      `}</style>
    </div>
  );
}
