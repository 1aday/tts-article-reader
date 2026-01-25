// Common voice name mappings for display
export const VOICE_NAMES: Record<string, string> = {
  // Premade voices
  "CwhRBWXzGAHq8TQ4Fs17": "Roger - Laid-Back, Casual",
  "EXAVITQu4vr4xnSDxMaL": "Sarah - Mature, Confident",
  "FGY2WhTYpPnrIDTdsKH5": "Laura - Enthusiastic",
  "IKne3meq5aSn9XLyUdCD": "Charlie - Deep, Energetic",
  "JBFqnCBsd6RMkjVDRZzb": "George - Warm Storyteller",
  "N2lVS1w4EtoT3dr4eOWO": "Callum - Husky",
  "SAz9YHcvj6GT2YYXdXww": "River - Relaxed, Neutral",
  "SOYHLrjzK2X1ezoPC6cr": "Harry - Fierce",
  "TX3LPaxmHKxFdv7VOQHJ": "Liam - Energetic Creator",
  "Xb7hH8MSUJpSbSDYk0k2": "Alice - Clear Educator",
  "XrExE9yKIg1WjnnlVkGX": "Matilda - Professional",
  "bIHbv24MWmeRgasZH58o": "Will - Relaxed Optimist",
  "cgSgspJ2msm6clMCkdW9": "Jessica - Playful, Warm",
  "cjVigY5qzO86Huf0OWal": "Eric - Smooth, Trustworthy",
  "hpp4J3VqNfWAUOO0d1Us": "Bella - Professional, Bright",
  "iP95p4xoKVk53GoZ742B": "Chris - Charming",
  "nPczCjzI2devNBz1zQrb": "Brian - Deep, Resonant",
  "onwK4e9ZLuTAKqWW03F9": "Daniel - Steady Broadcaster",
  "pFZP5JQG7iQjIQuC4Bku": "Lily - Velvety Actress",
  "pNInz6obpgDQGcFmaJgB": "Adam - Dominant, Firm",
  "pqHfZKP75CvOlQylNhV4": "Bill - Wise, Mature",
  "d94gCIrx5MpdYKm9Naj3": "gc",
};

export function getVoiceName(voiceId: string): string {
  return VOICE_NAMES[voiceId] || voiceId;
}
