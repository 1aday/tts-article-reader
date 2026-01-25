import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractWordCount } from "@/lib/api/firecrawl";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";

const validateSchema = z.object({
  text: z.string().min(1, "Text is required"),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json();
    const validation = validateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { text, title } = validation.data;
    const wordCount = extractWordCount(text);

    // Save to database
    const [article] = await db
      .insert(articles)
      .values({
        title,
        originalText: text,
        sourceType: "paste",
        wordCount,
        categorizationStatus: "pending",
      })
      .returning();

    // Trigger categorization (fire-and-forget)
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/categorization/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: article.id }),
    }).catch((err) => console.error("Failed to trigger categorization:", err));

    return NextResponse.json({
      success: true,
      article: {
        id: article.id,
        title: article.title,
        wordCount: article.wordCount,
        createdAt: article.createdAt,
      },
    });
  } catch (error) {
    console.error("Validate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
