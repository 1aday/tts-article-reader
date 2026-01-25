import { NextRequest } from "next/server";
import { z } from "zod";
import { enhanceText } from "@/lib/api/openai";
import { generateSpeech } from "@/lib/api/elevenlabs";
import { uploadAudio } from "@/lib/storage/blob-storage";
import { db } from "@/lib/db/client";
import { articles, audioFiles, processingJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rateLimits, getClientIp, formatRateLimitError } from "@/lib/rate-limit";

const generateSchema = z.object({
  articleId: z.number(),
  voiceId: z.string(),
  skipEnhancement: z.boolean().optional().default(false),
  // Audio generation settings
  stability: z.number().min(0).max(1).optional().default(0.5),
  similarityBoost: z.number().min(0).max(1).optional().default(0.75),
  style: z.number().min(0).max(1).optional().default(0),
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
        try {
          let textToSpeak = article.originalText;

          // Step 1: Enhance text (if not skipped)
          if (!skipEnhancement) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "progress", progress: 10, step: "Starting AI enhancement..." })}\n\n`)
            );

            await db
              .update(processingJobs)
              .set({ status: "enhancing", progress: 10, currentStep: "Enhancing text" })
              .where(eq(processingJobs.id, job.id));

            let enhancedText = "";
            let wordCount = 0;
            let chunkCount = 0;
            console.log(`[Generate] Starting text enhancement for article ${articleId}`);

            const textStream = await enhanceText(article.originalText);
            const originalWordCount = article.originalText.split(/\s+/).length;
            console.log(`[Generate] Original text has ${originalWordCount} words`);

            // Add timeout protection (5 minutes max for enhancement)
            const enhancementTimeout = setTimeout(() => {
              console.error(`[Generate] Enhancement timeout after 5 minutes`);
              throw new Error("Text enhancement timed out after 5 minutes");
            }, 5 * 60 * 1000);

            try {
              for await (const chunk of textStream) {
                enhancedText += chunk;
                chunkCount++;

                // Count words in the chunk and update progress
                const chunkWords = chunk.split(/\s+/).filter(w => w.length > 0).length;
                wordCount += chunkWords;

                // Update progress more frequently - every 25 words or every 10 chunks
                if (wordCount % 25 === 0 || chunkCount % 10 === 0) {
                  const enhancementProgress = Math.min(
                    10 + Math.floor((wordCount / originalWordCount) * 30),
                    39
                  );

                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      type: "progress",
                      progress: enhancementProgress,
                      step: `Enhancing text... (${wordCount}/${originalWordCount} words processed)`
                    })}\n\n`)
                  );

                  // Log progress for debugging
                  if (wordCount % 100 === 0) {
                    console.log(`[Generate] Enhancement progress: ${wordCount}/${originalWordCount} words (${enhancementProgress}%)`);
                  }
                }
              }

              clearTimeout(enhancementTimeout);
              console.log(`[Generate] Enhancement complete: ${wordCount} words, ${chunkCount} chunks`);
            } catch (error) {
              clearTimeout(enhancementTimeout);
              throw error;
            }

            textToSpeak = enhancedText;

            // Save enhanced text
            await db
              .update(articles)
              .set({ enhancedText })
              .where(eq(articles.id, articleId));

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "progress", progress: 40, step: "Text enhancement complete!" })}\n\n`)
            );
          }

          // Step 2: Generate speech (with chunking for long texts)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "progress", progress: 50, step: "Generating audio..." })}\n\n`)
          );

          await db
            .update(processingJobs)
            .set({ status: "generating", progress: 50, currentStep: "Generating audio" })
            .where(eq(processingJobs.id, job.id));

          // Chunk text if needed (ElevenLabs max is 30k characters)
          const MAX_CHUNK_SIZE = 25000; // Conservative limit for safety
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
            if (chunks[i].length > 30000) {
              throw new Error(`Chunk ${i + 1} exceeds 30,000 character limit (${chunks[i].length} chars)`);
            }
          }

          // Process chunks in parallel with rate limiting
          const MAX_CONCURRENT = 3; // Max 3 concurrent API calls to respect rate limits
          const audioBuffers: (Buffer | null)[] = new Array(chunks.length).fill(null);
          let completedChunks = 0;

          // Helper to process a single chunk
          const processChunk = async (i: number) => {
            const speechResponse = await generateSpeech({
              text: chunks[i],
              voiceId,
              voice_settings: voiceSettings,
            });

            const buffer = Buffer.from(await speechResponse.arrayBuffer());
            audioBuffers[i] = buffer; // Maintain correct order
            completedChunks++;

            // Send progress update for this completed chunk
            const progress = 50 + ((completedChunks / chunks.length) * 25);
            const chunkSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: "progress",
                progress: Math.round(progress),
                step: chunks.length > 1
                  ? `Generated ${completedChunks}/${chunks.length} parts (${chunkSizeMB} MB)...`
                  : "Generating audio...",
                chunkIndex: i + 1,
                totalChunks: chunks.length,
                completedChunks,
                chunkMetadata: {
                  characterCount: chunks[i].length
                }
              })}\n\n`)
            );

            return buffer;
          };

          // Process chunks in batches to respect API rate limits
          for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
            const batchEnd = Math.min(i + MAX_CONCURRENT, chunks.length);
            const batchIndices = Array.from({ length: batchEnd - i }, (_, idx) => i + idx);

            // Send batch start notification
            if (chunks.length > 1) {
              const batchNumber = Math.floor(i / MAX_CONCURRENT) + 1;
              const totalBatches = Math.ceil(chunks.length / MAX_CONCURRENT);

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: "progress",
                  progress: 50 + ((i / chunks.length) * 25),
                  step: `Processing batch ${batchNumber} (${batchIndices.length} parts in parallel)...`,
                  totalChunks: chunks.length,
                  completedChunks: i,
                  chunkMetadata: {
                    batchNumber,
                    totalBatches,
                    parallelChunks: batchIndices.length
                  }
                })}\n\n`)
              );
            }

            // Process batch in parallel
            await Promise.all(batchIndices.map(processChunk));
          }

          // Merge audio buffers in correct order
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: "progress",
              progress: 76,
              step: chunks.length > 1 ? `Merging ${chunks.length} audio parts...` : "Preparing audio..."
            })}\n\n`)
          );

          const validBuffers = audioBuffers.filter((b): b is Buffer => b !== null);
          const audioBuffer = Buffer.concat(validBuffers);
          const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: "progress",
              progress: 80,
              step: `Uploading audio (${fileSizeMB} MB)...`
            })}\n\n`)
          );

          // Step 3: Upload audio
          await db
            .update(processingJobs)
            .set({ status: "uploading", progress: 80, currentStep: "Uploading audio" })
            .where(eq(processingJobs.id, job.id));

          const filename = `article-${articleId}-${voiceId}-${Date.now()}.mp3`;
          const blobUrl = await uploadAudio(audioBuffer, filename);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: "progress",
              progress: 95,
              step: "Finalizing..."
            })}\n\n`)
          );

          // Step 4: Save to database
          const [audioFile] = await db
            .insert(audioFiles)
            .values({
              articleId,
              voiceId,
              voiceName: voiceId,
              blobUrl,
              duration: 0, // TODO: Calculate actual duration
              fileSize: audioBuffer.length,
              status: "completed",
            })
            .returning();

          await db
            .update(processingJobs)
            .set({ status: "completed", progress: 100, currentStep: "Completed" })
            .where(eq(processingJobs.id, job.id));

          // Send completion
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: "complete",
              progress: 100,
              audioFileId: audioFile.id,
              blobUrl
            })}\n\n`)
          );

          controller.close();
        } catch (error) {
          console.error("Generation error:", error);

          await db
            .update(processingJobs)
            .set({
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error"
            })
            .where(eq(processingJobs.id, job.id));

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Generation failed"
            })}\n\n`)
          );
          controller.close();
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
