import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { processingJobs, audioFiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const articleId = searchParams.get("articleId");

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    // Get the latest processing job for this article
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.articleId, parseInt(articleId)))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);

    if (!job) {
      return NextResponse.json(
        { status: "not_found", message: "No generation job found" },
        { status: 404 }
      );
    }

    // If completed, get the audio file details
    let audioFile = null;
    if (job.status === "completed") {
      const [audio] = await db
        .select()
        .from(audioFiles)
        .where(eq(audioFiles.articleId, parseInt(articleId)))
        .orderBy(desc(audioFiles.createdAt))
        .limit(1);

      audioFile = audio || null;
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      errorMessage: job.errorMessage,
      audioFile: audioFile ? {
        id: audioFile.id,
        blobUrl: audioFile.blobUrl,
        duration: audioFile.duration,
        fileSize: audioFile.fileSize,
      } : null,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
