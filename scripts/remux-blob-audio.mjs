import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
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

const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const selectedIds = idsArg
  ? idsArg
      .slice("--ids=".length)
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value))
  : [];

const estimateDurationSeconds = (sizeBytes) => (sizeBytes * 8) / 128000;

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function remuxBuffer(inputBuffer) {
  const dir = await mkdtemp(join(tmpdir(), "tts-blob-remux-"));
  const inputPath = join(dir, `${randomUUID()}.mp3`);
  const outputPath = join(dir, `${randomUUID()}-remux.mp3`);

  try {
    await writeFile(inputPath, inputBuffer);
    await runCommand("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const client = await pool.connect();
  let repaired = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const filters = ["blob_url LIKE 'http%'"];
    const params = [];

    if (selectedIds.length > 0) {
      params.push(selectedIds);
      filters.push(`id = ANY($${params.length}::int[])`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await client.query(
      `SELECT id, blob_url FROM audio_files ${whereClause} ORDER BY id ASC`,
      params,
    );

    console.log(`Found ${rows.length} blob-backed audio row(s) to process.`);

    for (const row of rows) {
      const audioId = row.id;
      const originalUrl = row.blob_url;

      try {
        const response = await fetch(originalUrl);
        if (!response.ok) {
          throw new Error(`download failed (${response.status})`);
        }

        const sourceBuffer = Buffer.from(await response.arrayBuffer());
        if (sourceBuffer.length === 0) {
          throw new Error("downloaded empty audio file");
        }

        const remuxedBuffer = await remuxBuffer(sourceBuffer);
        if (remuxedBuffer.length === 0) {
          throw new Error("remux produced empty audio file");
        }

        const url = new URL(originalUrl);
        const filename = url.pathname.split("/").pop();
        if (!filename) {
          throw new Error("unable to extract filename from blob URL");
        }

        const uploaded = await put(filename, remuxedBuffer, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "audio/mpeg",
          token: blobToken,
        });

        await client.query(
          `
            UPDATE audio_files
            SET blob_url = $1,
                file_size = $2,
                duration = $3,
                updated_at = NOW()
            WHERE id = $4
          `,
          [
            uploaded.url,
            remuxedBuffer.length,
            estimateDurationSeconds(remuxedBuffer.length),
            audioId,
          ],
        );

        repaired += 1;
        console.log(`[${audioId}] repaired (${(sourceBuffer.length / 1024 / 1024).toFixed(2)}MB -> ${(remuxedBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${audioId}] failed: ${message}`);
      }
    }

    console.log(`Done. repaired=${repaired}, skipped=${skipped}, failed=${failed}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Repair script failed:", error);
  process.exit(1);
});
