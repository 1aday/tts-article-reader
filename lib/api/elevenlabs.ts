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
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
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
    throw new Error(`Failed to fetch voices: ${response.statusText}`);
  }

  return response.json();
}

export async function generateSpeech(options: TTSOptions): Promise<Response> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const {
    text,
    voiceId,
    model_id = "eleven_turbo_v2_5",
    voice_settings = {
      stability: 0.5,
      similarity_boost: 0.8,
      use_speaker_boost: true,
    },
    output_format = "mp3_44100_128",
  } = options;

  // Filter voice_settings to only include supported parameters
  // This prevents temperature-related errors caused by unsupported parameters
  const cleanVoiceSettings: Record<string, any> = {
    stability: voice_settings.stability ?? 0.5,
    similarity_boost: voice_settings.similarity_boost ?? 0.8,
  };

  // Only add use_speaker_boost if provided
  if (voice_settings.use_speaker_boost !== undefined) {
    cleanVoiceSettings.use_speaker_boost = voice_settings.use_speaker_boost;
  }

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
    if (errorText.includes('max_character_limit_exceeded')) {
      errorMessage = `Text too long (${text.length} characters). Maximum is 30,000 characters. The text should have been chunked - this is a bug in the chunking logic.`;
    }

    throw new Error(`Failed to generate speech: ${errorMessage}`);
  }

  return response;
}
