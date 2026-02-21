import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { put, del } from "@vercel/blob";

// Dual storage system:
// - Development: Local filesystem (./storage/audio)
// - Production: Vercel Blob Storage (persistent, CDN-backed)

const canUseBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const STORAGE_DIR = join(process.cwd(), "storage", "audio");

async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
  }
}

function isLocalDatabaseConnection(): boolean {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    "";

  if (!connectionString) {
    return true;
  }

  return (
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
  );
}

export async function uploadAudio(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const shouldUseBlobStorage = canUseBlobStorage;

  if (shouldUseBlobStorage) {
    // Use Vercel Blob Storage whenever token is available so URLs are portable across environments.
    try {
      console.log("[Blob Storage] Attempting upload:", {
        filename,
        bufferSize: buffer.length,
        hasToken: canUseBlobStorage
      });

      const blob = await put(filename, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: "audio/mpeg", // Essential for browser playback
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
    // If a shared/remote DB is being used, local filesystem URLs become unreadable on other environments.
    if (!isLocalDatabaseConnection()) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required when using a remote database. Refusing to save non-portable local audio path."
      );
    }

    // Local fallback: Use filesystem only for local database workflows.
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
    const isLocalPath = blobUrl.startsWith("/storage/audio/");
    const shouldUseBlobStorage = canUseBlobStorage && !isLocalPath;

    if (shouldUseBlobStorage) {
      // Blob URL deletion
      await del(blobUrl);
    } else {
      // Local storage: Delete from filesystem
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
