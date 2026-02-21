import { NextRequest } from "next/server";
import { z } from "zod";
import { enhanceText } from "@/lib/api/openai";
import { generateSpeech } from "@/lib/api/elevenlabs";
import { uploadAudio } from "@/lib/storage/blob-storage";
import { db } from "@/lib/db/client";
import { articles, audioFiles, processingJobs, voices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rateLimits, getClientIp, formatRateLimitError } from "@/lib/rate-limit";
import { getVoiceName, isDisplayVoiceName } from "@/lib/voice-names";
import { DEFAULT_VOICE_AUDIO_SETTINGS } from "@/lib/audio-settings";

export const maxDuration = 300;

const ELEVENLABS_REQUEST_TIMEOUT_MS = 180_000;
const ELEVENLABS_MAX_RETRIES = 2;
const RETRY_DELAY_BASE_MS = 1_500;
const ENHANCEMENT_TIMEOUT_MS = 5 * 60 * 1000;
const ELEVENLABS_MODEL_ID = "eleven_v3";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const generateSchema = z.object({
  articleId: z.number(),
  voiceId: z.string(),
  voiceName: z.string().optional(),
  skipEnhancement: z.boolean().optional().default(false),
  // Audio generation settings
  stability: z.number().min(0).max(1).optional().default(DEFAULT_VOICE_AUDIO_SETTINGS.stability),
  similarityBoost: z.number().min(0).max(1).optional().default(DEFAULT_VOICE_AUDIO_SETTINGS.similarityBoost),
  style: z.number().min(0).max(1).optional().default(DEFAULT_VOICE_AUDIO_SETTINGS.style),
  useSpeakerBoost: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // Rate limiting
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await rateLimits.generate.limit(ip);

    if (!success) {
      return new Response(
        JSON.stringify({ error: formatRateLimitError(reset) }),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    // Parse request
    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: validation.error.issues }),
        { status: 400 }
      );
    }

    const {
      articleId,
      voiceId,
      voiceName,
      skipEnhancement,
      stability,
      similarityBoost,
      style,
      useSpeakerBoost,
    } = validation.data;

    // Prepare voice settings for ElevenLabs
    const voiceSettings = {
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost,
    };

    // Get article
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!article) {
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404 }
      );
    }

    // Resolve display name for the selected voice.
    let resolvedVoiceName = isDisplayVoiceName(voiceName, voiceId) ? voiceName!.trim() : "";
    if (!resolvedVoiceName) {
      const [voiceRecord] = await db
        .select({ name: voices.name })
        .from(voices)
        .where(eq(voices.id, voiceId))
        .limit(1);

      const dbVoiceName = voiceRecord?.name?.trim();
      if (isDisplayVoiceName(dbVoiceName, voiceId)) {
        resolvedVoiceName = dbVoiceName;
      } else {
        resolvedVoiceName = getVoiceName(voiceId);
      }
    }

    // Create processing job
    const [job] = await db
      .insert(processingJobs)
      .values({
        articleId,
        voiceId,
        status: "pending",
        progress: 0,
      })
      .returning();

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        const emitEvent = (payload: Record<string, unknown>) => {
          if (streamClosed) {
            return;
          }

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
            );
          } catch (streamError) {
            streamClosed = true;
            console.warn(
              "[Generate] SSE stream closed; continuing without live updates.",
              streamError
            );
          }
        };

        const closeStream = () => {
          if (streamClosed) {
            return;
          }

          try {
            controller.close();
          } catch (streamError) {
            console.warn("[Generate] SSE stream already closed.", streamError);
          } finally {
            streamClosed = true;
          }
        };

        try {
          let textToSpeak = article.originalText;
          const storedEnhancedText = article.enhancedText?.trim();
          const canReuseStoredEnhancedText = !skipEnhancement && Boolean(storedEnhancedText);

          // Step 1: Reuse stored enhancement or run a new enhancement pass
          if (canReuseStoredEnhancedText) {
            textToSpeak = storedEnhancedText!;
            console.log(`[Generate] Reusing stored enhanced text for article ${articleId}`);

            await db
              .update(processingJobs)
              .set({
                status: "enhancing",
                progress: 40,
                currentStep: "Using saved enhanced text",
                updatedAt: new Date(),
              })
              .where(eq(processingJobs.id, job.id));

            emitEvent({ type: "progress", progress: 40, step: "Using saved enhanced text..." });
          } else if (!skipEnhancement) {
            emitEvent({ type: "progress", progress: 10, step: "Starting AI enhancement..." });

            await db
              .update(processingJobs)
              .set({
                status: "enhancing",
                progress: 10,
                currentStep: "Enhancing text",
                updatedAt: new Date(),
              })
              .where(eq(processingJobs.id, job.id));

            let enhancedText = "";
            let wordCount = 0;
            let chunkCount = 0;
            console.log(`[Generate] Starting text enhancement for article ${articleId}`);

            const textStream = await enhanceText(article.originalText);
            const originalWordCount = Math.max(
              article.originalText.split(/\s+/).filter((w) => w.length > 0).length,
              1
            );
            console.log(`[Generate] Original text has ${originalWordCount} words`);

            let enhancementTimeoutId: ReturnType<typeof setTimeout> | null = null;
            try {
              await Promise.race([
                (async () => {
                  for await (const chunk of textStream) {
                    enhancedText += chunk;
                    chunkCount++;

                    // Count words in the chunk and update progress
                    const chunkWords = chunk.split(/\s+/).filter((w) => w.length > 0).length;
                    wordCount += chunkWords;

                    // Update progress more frequently - every 25 words or every 10 chunks
                    if (wordCount % 25 === 0 || chunkCount % 10 === 0) {
                      const sourceWordsCovered = Math.min(wordCount, originalWordCount);
                      const enhancementProgress = Math.min(
                        10 + Math.floor((sourceWordsCovered / originalWordCount) * 30),
                        39
                      );
                      const step =
                        wordCount <= originalWordCount
                          ? `Enhancing text... (${wordCount}/${originalWordCount} source words covered)`
                          : `Enhancing text... (${wordCount} words streamed; source ${originalWordCount})`;

                      emitEvent({
                        type: "progress",
                        progress: enhancementProgress,
                        step,
                      });

                      // Log progress for debugging
                      if (wordCount % 100 === 0) {
                        console.log(
                          `[Generate] Enhancement progress: ${sourceWordsCovered}/${originalWordCount} source words (${enhancementProgress}%)`
                        );
                      }
                    }
                  }
                })(),
                new Promise<never>((_, reject) => {
                  enhancementTimeoutId = setTimeout(() => {
                    reject(new Error("Text enhancement timed out after 5 minutes"));
                  }, ENHANCEMENT_TIMEOUT_MS);
                }),
              ]);
            } finally {
              if (enhancementTimeoutId) {
                clearTimeout(enhancementTimeoutId);
              }
            }

            console.log(`[Generate] Enhancement complete: ${wordCount} words, ${chunkCount} chunks`);

            textToSpeak = enhancedText;

            // Save enhanced text
            await db
              .update(articles)
              .set({ enhancedText })
              .where(eq(articles.id, articleId));

            await db
              .update(processingJobs)
              .set({
                status: "enhancing",
                progress: 40,
                currentStep: "Text enhancement complete",
                updatedAt: new Date(),
              })
              .where(eq(processingJobs.id, job.id));

            emitEvent({ type: "progress", progress: 40, step: "Text enhancement complete!" });
          } else {
            console.log(`[Generate] Skipping text enhancement for article ${articleId}`);

            await db
              .update(processingJobs)
              .set({
                status: "enhancing",
                progress: 40,
                currentStep: "AI enhancement skipped",
                updatedAt: new Date(),
              })
              .where(eq(processingJobs.id, job.id));

            emitEvent({ type: "progress", progress: 40, step: "Skipping AI enhancement..." });
          }

          // Step 2: Generate speech (with chunking for long texts)
          emitEvent({ type: "progress", progress: 50, step: "Generating audio..." });

          await db
            .update(processingJobs)
            .set({
              status: "generating",
              progress: 50,
              currentStep: "Generating audio",
              updatedAt: new Date(),
            })
            .where(eq(processingJobs.id, job.id));

          // ElevenLabs v3 enforces a 5,000 character limit per request.
          const MAX_CHUNK_SIZE = 4500;
          const HARD_CHUNK_LIMIT = 5000;
          const chunks: string[] = [];

          if (textToSpeak.length <= MAX_CHUNK_SIZE) {
            chunks.push(textToSpeak);
          } else {
            // Split on sentence boundaries for better audio quality
            let remainingText = textToSpeak;

            while (remainingText.length > 0) {
              if (remainingText.length <= MAX_CHUNK_SIZE) {
                chunks.push(remainingText.trim());
                break;
              }

              // Find a good break point (sentence end near the chunk size)
              // Look for sentence endings within a reasonable range before the limit
              const searchEndPoint = Math.min(MAX_CHUNK_SIZE, remainingText.length);
              const searchText = remainingText.substring(0, searchEndPoint);

              // Match sentence boundaries: period, question mark, exclamation followed by space/newline/end
              const sentencePattern = /[.!?][\s\n]+/g;
              const matches = [...searchText.matchAll(sentencePattern)];

              let breakPoint = MAX_CHUNK_SIZE;

              if (matches.length > 0) {
                // Use the last sentence boundary found
                const lastMatch = matches[matches.length - 1];
                breakPoint = (lastMatch.index || 0) + lastMatch[0].length;
              } else {
                // No sentence boundary found, look for paragraph break
                const paragraphBreak = searchText.lastIndexOf('\n\n');
                if (paragraphBreak > MAX_CHUNK_SIZE * 0.7) {
                  breakPoint = paragraphBreak + 2;
                } else {
                  // Last resort: break at last space
                  const lastSpace = searchText.lastIndexOf(' ');
                  if (lastSpace > MAX_CHUNK_SIZE * 0.8) {
                    breakPoint = lastSpace + 1;
                  }
                }
              }

              const chunk = remainingText.substring(0, breakPoint).trim();
              if (chunk.length > 0) {
                chunks.push(chunk);
              }

              remainingText = remainingText.substring(breakPoint).trim();
            }
          }

          // Validate chunks
          console.log(`Text split into ${chunks.length} chunks`);
          for (let i = 0; i < chunks.length; i++) {
            console.log(`Chunk ${i + 1} length: ${chunks[i].length} characters`);
            if (chunks[i].length > HARD_CHUNK_LIMIT) {
              throw new Error(
                `Chunk ${i + 1} exceeds ${HARD_CHUNK_LIMIT.toLocaleString()} character limit (${chunks[i].length} chars)`
              );
            }
          }

          // Process chunks in parallel with rate limiting
          const MAX_CONCURRENT = 2;
          const audioBuffers: (Buffer | null)[] = new Array(chunks.length).fill(null);
          let completedChunks = 0;

          // Helper to process a single chunk
          const processChunk = async (i: number) => {
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= ELEVENLABS_MAX_RETRIES + 1; attempt++) {
              try {
                const buffer = await generateSpeech({
                  text: chunks[i],
                  voiceId,
                  model_id: ELEVENLABS_MODEL_ID,
                  voice_settings: voiceSettings,
                  timeoutMs: ELEVENLABS_REQUEST_TIMEOUT_MS,
                });

                audioBuffers[i] = buffer; // Maintain correct order
                completedChunks++;

                // Send progress update for this completed chunk
                const progress = Math.round(50 + ((completedChunks / chunks.length) * 25));
                const chunkSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
                const step = chunks.length > 1
                  ? `Generated ${completedChunks}/${chunks.length} parts (${chunkSizeMB} MB)...`
                  : "Generating audio...";

                await db
                  .update(processingJobs)
                  .set({
                    status: "generating",
                    progress,
                    currentStep: step,
                    updatedAt: new Date(),
                  })
                  .where(eq(processingJobs.id, job.id));

                emitEvent({
                  type: "progress",
                  progress,
                  step,
                  chunkIndex: i + 1,
                  totalChunks: chunks.length,
                  completedChunks,
                  chunkMetadata: {
                    characterCount: chunks[i].length,
                  },
                });

                return buffer;
              } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt <= ELEVENLABS_MAX_RETRIES) {
                  const retryStep = `Retrying audio part ${i + 1}/${chunks.length} (attempt ${attempt + 1}/${ELEVENLABS_MAX_RETRIES + 1})...`;

                  await db
                    .update(processingJobs)
                    .set({
                      status: "generating",
                      currentStep: retryStep,
                      updatedAt: new Date(),
                    })
                    .where(eq(processingJobs.id, job.id));

                  emitEvent({
                    type: "progress",
                    progress: Math.round(50 + ((completedChunks / chunks.length) * 25)),
                    step: retryStep,
                    chunkIndex: i + 1,
                    totalChunks: chunks.length,
                    completedChunks,
                  });

                  await sleep(RETRY_DELAY_BASE_MS * attempt);
                  continue;
                }
              }
            }

            throw new Error(
              `Audio generation failed for part ${i + 1}/${chunks.length}: ${lastError?.message ?? "Unknown error"}`
            );
          };

          // Process chunks in batches to respect API rate limits
          for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
            const batchEnd = Math.min(i + MAX_CONCURRENT, chunks.length);
            const batchIndices = Array.from({ length: batchEnd - i }, (_, idx) => i + idx);

            // Send batch start notification
            if (chunks.length > 1) {
              const batchNumber = Math.floor(i / MAX_CONCURRENT) + 1;
              const totalBatches = Math.ceil(chunks.length / MAX_CONCURRENT);
              const batchProgress = Math.round(50 + ((i / chunks.length) * 25));
              const batchStep = `Processing batch ${batchNumber} (${batchIndices.length} parts in parallel)...`;

              await db
                .update(processingJobs)
                .set({
                  status: "generating",
                  progress: batchProgress,
                  currentStep: batchStep,
                  updatedAt: new Date(),
                })
                .where(eq(processingJobs.id, job.id));

              emitEvent({
                type: "progress",
                progress: batchProgress,
                step: batchStep,
                totalChunks: chunks.length,
                completedChunks: i,
                chunkMetadata: {
                  batchNumber,
                  totalBatches,
                  parallelChunks: batchIndices.length
                }
              });
            }

            // Process batch in parallel
            await Promise.all(batchIndices.map(processChunk));
          }

          // Merge audio buffers in correct order
          emitEvent({
            type: "progress",
            progress: 76,
            step: chunks.length > 1 ? `Merging ${chunks.length} audio parts...` : "Preparing audio..."
          });

          const validBuffers = audioBuffers.filter((b): b is Buffer => b !== null);
          const audioBuffer = Buffer.concat(validBuffers);
          const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);

          emitEvent({
            type: "progress",
            progress: 80,
            step: `Uploading audio (${fileSizeMB} MB)...`
          });

          // Step 3: Upload audio
          await db
            .update(processingJobs)
            .set({
              status: "uploading",
              progress: 80,
              currentStep: "Uploading audio",
              updatedAt: new Date(),
            })
            .where(eq(processingJobs.id, job.id));

          const filename = `article-${articleId}-${voiceId}-${Date.now()}.mp3`;
          const blobUrl = await uploadAudio(audioBuffer, filename);

          emitEvent({
            type: "progress",
            progress: 95,
            step: "Finalizing..."
          });

          // Step 4: Save to database
          const [audioFile] = await db
            .insert(audioFiles)
            .values({
              articleId,
              voiceId,
              voiceName: resolvedVoiceName,
              blobUrl,
              duration: 0, // TODO: Calculate actual duration
              fileSize: audioBuffer.length,
              status: "completed",
            })
            .returning();

          await db
            .update(processingJobs)
            .set({
              status: "completed",
              progress: 100,
              currentStep: "Completed",
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(processingJobs.id, job.id));

          // Send completion
          emitEvent({
            type: "complete",
            progress: 100,
            audioFileId: audioFile.id,
            blobUrl
          });

          closeStream();
        } catch (error) {
          console.error("Generation error:", error);

          await db
            .update(processingJobs)
            .set({
              status: "failed",
              currentStep: "Failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
              updatedAt: new Date(),
            })
            .where(eq(processingJobs.id, job.id));

          emitEvent({
            type: "error",
            error: error instanceof Error ? error.message : "Generation failed"
          });
          closeStream();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
