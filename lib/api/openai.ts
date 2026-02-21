import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

const ENHANCEMENT_PROMPT = `Transform article text for natural text-to-speech by:
1. Adding [pause] tags after sentences (sparingly, only where natural pauses would occur)
2. Fixing capitalization for proper nouns and acronyms
3. Improving punctuation for natural pacing (commas, periods)
4. Breaking up overly long sentences into shorter, more digestible ones
5. Maintaining the original meaning and tone

IMPORTANT: Only modify punctuation and add pause tags. Do not change the core content, wording, or meaning.

Return ONLY the enhanced text without any explanations or metadata.`;

export async function enhanceText(text: string): Promise<AsyncIterable<string>> {
  console.log(`[OpenAI] Starting text enhancement (${text.length} characters)`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is required for AI text enhancement");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  const stream = await openaiClient.chat.completions.create({
    model: "gpt-5-nano",
    messages: [
      {
        role: "system",
        content: ENHANCEMENT_PROMPT,
      },
      {
        role: "user",
        content: text,
      },
    ],
    stream: true,
    verbosity: "medium",
    reasoning_effort: "low",
  });

  console.log(`[OpenAI] Stream created successfully`);

  return (async function* () {
    let totalChunks = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        totalChunks++;
        if (totalChunks % 50 === 0) {
          console.log(`[OpenAI] Streamed ${totalChunks} chunks so far`);
        }
        yield content;
      }
    }
    console.log(`[OpenAI] Enhancement complete - ${totalChunks} total chunks`);
  })();
}
