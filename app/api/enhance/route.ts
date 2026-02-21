import { NextRequest } from "next/server";
import { z } from "zod";
import { enhanceText } from "@/lib/api/openai";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const enhanceSchema = z.object({
  articleId: z.number(),
});

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // Parse request
    const body = await request.json();
    const validation = enhanceSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: validation.error.issues }),
        { status: 400 }
      );
    }

    const { articleId } = validation.data;

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
              "[Enhance] SSE stream closed; continuing without live updates.",
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
            console.warn("[Enhance] SSE stream already closed.", streamError);
          } finally {
            streamClosed = true;
          }
        };

        try {
          let enhancedText = "";

          // Send initial progress
          emitEvent({ type: "progress", progress: 0, step: "Enhancing text..." });

          // Stream enhanced text
          const textStream = await enhanceText(article.originalText);

          for await (const chunk of textStream) {
            enhancedText += chunk;
            emitEvent({ type: "chunk", content: chunk });
          }

          // Save enhanced text to database
          await db
            .update(articles)
            .set({ enhancedText })
            .where(eq(articles.id, articleId));

          // Send completion
          emitEvent({ type: "complete", enhancedText });

          closeStream();
        } catch (error) {
          console.error("[Enhance] Enhancement error:", error);
          emitEvent({ type: "error", error: "Enhancement failed" });
          closeStream();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Enhance error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
