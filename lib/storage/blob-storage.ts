import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Simple local file storage for development
// In production, replace with Vercel Blob

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
  await ensureStorageDir();

  const filepath = join(STORAGE_DIR, filename);
  await writeFile(filepath, buffer);

  // Return a URL path that can be served
  return `/storage/audio/${filename}`;
}

export function getAudioPath(filename: string): string {
  return join(STORAGE_DIR, filename);
}

export async function deleteAudio(blobUrl: string): Promise<void> {
  try {
    // Extract filename from URL path (e.g., "/storage/audio/filename.mp3" -> "filename.mp3")
    const filename = blobUrl.split("/").pop();
    if (!filename) {
      console.warn(`Invalid blob URL: ${blobUrl}`);
      return;
    }

    const filepath = join(STORAGE_DIR, filename);
    await unlink(filepath);
  } catch (error) {
    // File might not exist - log but don't throw
    console.warn(`Failed to delete file: ${blobUrl}`, error);
  }
}
