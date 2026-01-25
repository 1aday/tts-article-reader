import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { put, del } from "@vercel/blob";

// Dual storage system:
// - Development: Local filesystem (./storage/audio)
// - Production: Vercel Blob Storage (persistent, CDN-backed)

const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const STORAGE_DIR = join(process.cwd(), "storage", "audio");

async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
  }
}

export async function uploadAudio(
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (isProduction) {
    // Production: Use Vercel Blob Storage
    try {
      console.log("[Blob Storage] Attempting upload:", {
        filename,
        bufferSize: buffer.length,
        hasToken: !!process.env.BLOB_READ_WRITE_TOKEN
      });

      const blob = await put(filename, buffer, {
        access: "public",
        addRandomSuffix: false,
      });

      console.log("[Blob Storage] Upload successful:", blob.url);
      return blob.url;
    } catch (error) {
      console.error("[Blob Storage] Upload failed:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to upload audio file to storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Development: Use local filesystem
    await ensureStorageDir();
    const filepath = join(STORAGE_DIR, filename);
    await writeFile(filepath, buffer);
    return `/storage/audio/${filename}`;
  }
}

export function getAudioPath(filename: string): string {
  // Only used in development for local file serving
  return join(STORAGE_DIR, filename);
}

export async function deleteAudio(blobUrl: string): Promise<void> {
  try {
    if (isProduction) {
      // Production: Delete from Vercel Blob
      // blobUrl is the full Vercel Blob URL
      await del(blobUrl);
    } else {
      // Development: Delete from local filesystem
      const filename = blobUrl.split("/").pop();
      if (!filename) {
        console.warn(`Invalid blob URL: ${blobUrl}`);
        return;
      }
      const filepath = join(STORAGE_DIR, filename);
      await unlink(filepath);
    }
  } catch (error) {
    // File might not exist - log but don't throw
    console.warn(`Failed to delete file: ${blobUrl}`, error);
  }
}
