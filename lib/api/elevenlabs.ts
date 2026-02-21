import { DEFAULT_VOICE_AUDIO_SETTINGS } from "@/lib/audio-settings";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface VoicesResponse {
  voices: Voice[];
}

export interface TTSOptions {
  text: string;
  voiceId: string;
  model_id?: string;
  timeoutMs?: number;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  output_format?: string;
}

export async function getVoices(): Promise<VoicesResponse> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail?.message) {
        errorMessage = errorJson.detail.message;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorText.trim()) {
        errorMessage = errorText;
      }
    }

    throw new Error(`Failed to fetch voices (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const {
    text,
    voiceId,
    model_id = "eleven_v3",
    timeoutMs = 120_000,
    voice_settings = {
      stability: DEFAULT_VOICE_AUDIO_SETTINGS.stability,
      similarity_boost: DEFAULT_VOICE_AUDIO_SETTINGS.similarityBoost,
      style: DEFAULT_VOICE_AUDIO_SETTINGS.style,
      use_speaker_boost: true,
    },
    output_format = "mp3_44100_128",
  } = options;

  // Filter voice_settings to only include supported parameters
  // This prevents temperature-related errors caused by unsupported parameters
  const cleanVoiceSettings: NonNullable<TTSOptions["voice_settings"]> = {
    stability: voice_settings.stability ?? DEFAULT_VOICE_AUDIO_SETTINGS.stability,
    similarity_boost: voice_settings.similarity_boost ?? DEFAULT_VOICE_AUDIO_SETTINGS.similarityBoost,
    style: voice_settings.style ?? DEFAULT_VOICE_AUDIO_SETTINGS.style,
  };

  // Only add use_speaker_boost if provided
  if (voice_settings.use_speaker_boost !== undefined) {
    cleanVoiceSettings.use_speaker_boost = voice_settings.use_speaker_boost;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id,
          voice_settings: cleanVoiceSettings,
          output_format,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail?.message) {
          errorMessage = errorJson.detail.message;
        }
      } catch {
        // Use raw error text if not JSON
      }

      // Add text length info for character limit errors
      if (errorText.includes("max_character_limit_exceeded")) {
        errorMessage = `Text too long (${text.length} characters). The text should have been chunked for the selected model.`;
      }

      throw new Error(`Failed to generate speech: ${errorMessage}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`ElevenLabs request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
