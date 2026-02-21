export interface VoiceAudioSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export interface GenerationAudioSettings extends VoiceAudioSettings {
  enableScriptEnhancement: boolean;
}

export const DEFAULT_VOICE_AUDIO_SETTINGS: VoiceAudioSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.58,
  useSpeakerBoost: true,
};

export const DEFAULT_GENERATION_AUDIO_SETTINGS: GenerationAudioSettings = {
  ...DEFAULT_VOICE_AUDIO_SETTINGS,
  enableScriptEnhancement: true,
};

export const AUDIO_SETTING_DESCRIPTIONS = {
  stability:
    "Controls voice consistency. Lower values add more variation, higher values make it more stable.",
  similarityBoost:
    "Enhances similarity to the original voice. Higher values make it sound more like the training data.",
  style:
    "Adjusts the expressive range. Higher values increase emotional variation.",
  speakerBoost:
    "Enhances voice clarity and presence for better audio quality.",
} as const;

export const AUDIO_QUICK_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  settings: VoiceAudioSettings;
}> = [
  {
    id: "balanced",
    label: "Balanced",
    description: "V3 default profile",
    settings: {
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.58,
      useSpeakerBoost: true,
    },
  },
  {
    id: "expressive",
    label: "Expressive",
    description: "More emotion and range",
    settings: {
      stability: 0.42,
      similarityBoost: 0.72,
      style: 0.84,
      useSpeakerBoost: true,
    },
  },
  {
    id: "studio",
    label: "Studio",
    description: "Tighter and cleaner",
    settings: {
      stability: 0.68,
      similarityBoost: 0.78,
      style: 0.34,
      useSpeakerBoost: true,
    },
  },
];

export function parseAudioSettingParam(rawValue: string | null, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}
