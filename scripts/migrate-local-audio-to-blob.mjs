import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { Pool } from "pg";
import { put } from "@vercel/blob";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!connectionString) {
  console.error("POSTGRES_URL or DATABASE_URL is required.");
  process.exit(1);
}

if (!blobToken) {
  console.error("BLOB_READ_WRITE_TOKEN is required.");
  process.exit(1);
}

const isLocalConnection =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: isLocalConnection ? false : { rejectUnauthorized: false },
});

const STORAGE_DIR = join(process.cwd(), "storage", "audio");

async function migrate() {
  const client = await pool.connect();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const { rows } = await client.query(
      "SELECT id, blob_url FROM audio_files WHERE blob_url LIKE '/storage/audio/%' ORDER BY id ASC"
    );

    if (rows.length === 0) {
      console.log("No local audio paths found. Nothing to migrate.");
      return;
    }

    console.log(`Found ${rows.length} audio rows with local paths.`);

    for (const row of rows) {
      const audioId = row.id;
      const blobUrl = row.blob_url;
      const filename = String(blobUrl).split("/").pop();

      if (!filename) {
        console.warn(`[${audioId}] Invalid local URL: ${blobUrl}`);
        failed += 1;
        continue;
      }

      const localPath = join(STORAGE_DIR, filename);

      let fileBuffer;
      try {
        fileBuffer = await readFile(localPath);
      } catch (error) {
        console.warn(`[${audioId}] Missing local file, skipping: ${localPath}`);
        skipped += 1;
        continue;
      }

      try {
        const uploadedBlob = await put(filename, fileBuffer, {
          access: "public",
          addRandomSuffix: false,
          contentType: "audio/mpeg",
          token: blobToken,
        });

        await client.query(
          "UPDATE audio_files SET blob_url = $1, updated_at = NOW() WHERE id = $2",
          [uploadedBlob.url, audioId]
        );

        migrated += 1;
        console.log(`[${audioId}] Migrated -> ${uploadedBlob.url}`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${audioId}] Upload failed: ${message}`);
      }
    }

    console.log(
      `Migration complete. migrated=${migrated}, skipped=${skipped}, failed=${failed}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
