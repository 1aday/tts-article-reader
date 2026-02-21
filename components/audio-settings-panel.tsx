"use client";

import { cn } from "@/lib/utils";
import {
  AUDIO_QUICK_PRESETS,
  AUDIO_SETTING_DESCRIPTIONS,
  DEFAULT_GENERATION_AUDIO_SETTINGS,
} from "@/lib/audio-settings";

interface AudioSettingsPanelProps {
  stability: number;
  onStabilityChange: (value: number) => void;
  similarityBoost: number;
  onSimilarityBoostChange: (value: number) => void;
  style: number;
  onStyleChange: (value: number) => void;
  useSpeakerBoost: boolean;
  onUseSpeakerBoostChange: (value: boolean) => void;
  enableScriptEnhancement: boolean;
  onEnableScriptEnhancementChange: (value: boolean) => void;
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
        <span className="text-sm font-mono text-white/80">
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
        className="slider-thumb h-2 w-full cursor-pointer appearance-none rounded-lg bg-black/35"
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
  enableScriptEnhancement,
  onEnableScriptEnhancementChange,
  className,
}: AudioSettingsPanelProps) {
  const handleReset = () => {
    onStabilityChange(DEFAULT_GENERATION_AUDIO_SETTINGS.stability);
    onSimilarityBoostChange(DEFAULT_GENERATION_AUDIO_SETTINGS.similarityBoost);
    onStyleChange(DEFAULT_GENERATION_AUDIO_SETTINGS.style);
    onUseSpeakerBoostChange(DEFAULT_GENERATION_AUDIO_SETTINGS.useSpeakerBoost);
    onEnableScriptEnhancementChange(DEFAULT_GENERATION_AUDIO_SETTINGS.enableScriptEnhancement);
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
          className="text-sm text-white/70 transition-colors hover:text-white"
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
          tooltip={AUDIO_SETTING_DESCRIPTIONS.stability}
        />

        <Slider
          label="Similarity Boost"
          value={similarityBoost}
          onChange={onSimilarityBoostChange}
          tooltip={AUDIO_SETTING_DESCRIPTIONS.similarityBoost}
        />

        <Slider
          label="Style"
          value={style}
          onChange={onStyleChange}
          tooltip={AUDIO_SETTING_DESCRIPTIONS.style}
        />
      </div>

      {/* Speaker Boost Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-white/15 bg-black/25 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-[#e50914]">
            Speaker Boost
          </label>
          <p className="text-xs text-gray-400">
            {AUDIO_SETTING_DESCRIPTIONS.speakerBoost}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUseSpeakerBoostChange(!useSpeakerBoost)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4",
            useSpeakerBoost ? "bg-[#e50914]" : "bg-[--color-border]"
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

      {/* Script Enhancement Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-white/15 bg-black/25 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-[#e50914]">
            AI Script Enhancement (Optional)
          </label>
          <p className="text-xs text-gray-400">
            Improves punctuation and pacing before TTS. Turn off for faster, original-text output.
          </p>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">
            {enableScriptEnhancement ? "On" : "Off"}
          </span>
          <button
            type="button"
            onClick={() => onEnableScriptEnhancementChange(!enableScriptEnhancement)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              enableScriptEnhancement ? "bg-[#e50914]" : "bg-[--color-border]"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                enableScriptEnhancement ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#e50914]">
          Quick Presets (v3)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {AUDIO_QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onStabilityChange(preset.settings.stability);
                onSimilarityBoostChange(preset.settings.similarityBoost);
                onStyleChange(preset.settings.style);
                onUseSpeakerBoostChange(preset.settings.useSpeakerBoost);
              }}
              className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-left text-sm transition-colors hover:border-[#e50914]/50 hover:text-white"
              title={preset.description}
            >
              <span className="block leading-tight">{preset.label}</span>
              <span className="block text-[11px] text-white/45 leading-tight">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: #e50914;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(229, 9, 20, 0.45);
        }

        .slider-thumb::-moz-range-thumb {
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: #e50914;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(229, 9, 20, 0.45);
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
