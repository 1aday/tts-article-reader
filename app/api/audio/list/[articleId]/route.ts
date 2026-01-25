import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { audioFiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const articleIdNum = parseInt(articleId);

    // Get all audio files for this article, ordered by creation date (newest first)
    const audioFilesList = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.articleId, articleIdNum))
      .orderBy(desc(audioFiles.createdAt));

    return NextResponse.json(audioFilesList);
  } catch (error) {
    console.error("Audio list fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio list" },
      { status: 500 }
    );
  }
}
