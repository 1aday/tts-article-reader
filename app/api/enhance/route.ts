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
        try {
          let enhancedText = "";

          // Send initial progress
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "progress", progress: 0, step: "Enhancing text..." })}\n\n`)
          );

          // Stream enhanced text
          const textStream = await enhanceText(article.originalText);

          for await (const chunk of textStream) {
            enhancedText += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`)
            );
          }

          // Save enhanced text to database
          await db
            .update(articles)
            .set({ enhancedText })
            .where(eq(articles.id, articleId));

          // Send completion
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "complete", enhancedText })}\n\n`)
          );

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Enhancement failed" })}\n\n`)
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
