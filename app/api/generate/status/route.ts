import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { processingJobs, audioFiles } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveAudioDurationSeconds } from "@/lib/audio-duration";

const ACTIVE_STATUSES = new Set(["pending", "enhancing", "generating", "uploading"]);
const JOB_STALE_TIMEOUT_MS = 6 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const articleId = searchParams.get("articleId");
    const voiceId = searchParams.get("voiceId");

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    const parsedArticleId = Number.parseInt(articleId, 10);
    if (Number.isNaN(parsedArticleId)) {
      return NextResponse.json(
        { error: "Invalid article ID" },
        { status: 400 }
      );
    }

    // Get the latest processing job for this article
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(
        voiceId
          ? and(
              eq(processingJobs.articleId, parsedArticleId),
              eq(processingJobs.voiceId, voiceId)
            )
          : eq(processingJobs.articleId, parsedArticleId)
      )
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);

    if (!job) {
      return NextResponse.json(
        { status: "not_found", message: "No generation job found" },
        { status: 404 }
      );
    }

    let currentJob = job;

    const lastActivityRaw = currentJob.updatedAt ?? currentJob.createdAt;
    const lastActivityMs = lastActivityRaw ? new Date(lastActivityRaw).getTime() : NaN;
    const isInProgress = ACTIVE_STATUSES.has(currentJob.status);
    const isStale = Number.isFinite(lastActivityMs) && (Date.now() - lastActivityMs) > JOB_STALE_TIMEOUT_MS;

    if (isInProgress && isStale) {
      const timeoutMessage = "Generation timed out while creating audio. Please try again.";
      const [failedJob] = await db
        .update(processingJobs)
        .set({
          status: "failed",
          currentStep: "Failed",
          errorMessage: timeoutMessage,
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, currentJob.id))
        .returning();

      if (failedJob) {
        currentJob = failedJob;
      } else {
        currentJob = {
          ...currentJob,
          status: "failed",
          currentStep: "Failed",
          errorMessage: timeoutMessage,
        };
      }
    }

    // If completed, get the audio file details
    let audioFile = null;
    if (currentJob.status === "completed") {
      const [audio] = await db
        .select()
        .from(audioFiles)
        .where(
          and(
            eq(audioFiles.articleId, parsedArticleId),
            eq(audioFiles.voiceId, currentJob.voiceId)
          )
        )
        .orderBy(desc(audioFiles.createdAt))
        .limit(1);

      audioFile = audio || null;

      // Treat "completed without output" as not found so clients can start a new job.
      if (!audioFile) {
        return NextResponse.json(
          { status: "not_found", message: "Completed job has no audio output" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      jobId: currentJob.id,
      status: currentJob.status,
      progress: currentJob.progress,
      currentStep: currentJob.currentStep,
      startedAt: currentJob.createdAt ?? null,
      errorMessage: currentJob.errorMessage,
      audioFile: audioFile ? {
        id: audioFile.id,
        blobUrl: audioFile.blobUrl,
        duration: resolveAudioDurationSeconds(audioFile.duration, audioFile.fileSize),
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
