import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles, audioFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteAudio } from "@/lib/storage/blob-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id);

    // Get article from database
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error("Article fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id);

    // Get all audio files for this article
    const audioFilesList = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.articleId, articleId));

    // Delete all physical audio files
    for (const audio of audioFilesList) {
      if (audio.blobUrl) {
        await deleteAudio(audio.blobUrl);
      }
    }

    // Delete article (this will cascade delete audioFiles records due to foreign key constraint)
    await db.delete(articles).where(eq(articles.id, articleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Article deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}
