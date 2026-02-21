import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { articles, audioFiles } from "@/lib/db/schema";

const sanitizeFilenamePart = (value: string | null | undefined, fallback: string) => {
  const normalized = (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || fallback;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const audioId = Number.parseInt(id, 10);

    if (!Number.isFinite(audioId) || audioId <= 0) {
      return NextResponse.json({ error: "Invalid audio id" }, { status: 400 });
    }

    const [audioFile] = await db
      .select({
        id: audioFiles.id,
        articleId: audioFiles.articleId,
        voiceName: audioFiles.voiceName,
        blobUrl: audioFiles.blobUrl,
      })
      .from(audioFiles)
      .where(eq(audioFiles.id, audioId))
      .limit(1);

    if (!audioFile || !audioFile.blobUrl) {
      return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
    }

    const [article] = await db
      .select({ title: articles.title })
      .from(articles)
      .where(eq(articles.id, audioFile.articleId))
      .limit(1);

    const upstreamUrl = audioFile.blobUrl.startsWith("/")
      ? `${request.nextUrl.origin}${audioFile.blobUrl}`
      : audioFile.blobUrl;

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const upstreamError = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: upstreamError || "Failed to fetch source audio",
        },
        { status: upstream.status || 500 },
      );
    }

    const safeArticleTitle = sanitizeFilenamePart(article?.title, `article-${audioFile.articleId}`);
    const safeVoiceName = sanitizeFilenamePart(audioFile.voiceName, "voice");
    const downloadFilename = `${safeArticleTitle}-${safeVoiceName}-${audioFile.id}.mp3`;

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    headers.set("Content-Disposition", `attachment; filename="${downloadFilename}"`);
    headers.set("Cache-Control", "no-store");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Audio download error:", error);
    return NextResponse.json({ error: "Failed to download audio" }, { status: 500 });
  }
}
