import { put } from "@vercel/blob";

type StorageProvider = "supabase" | "vercel-blob";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "generated-images";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

interface UploadImageOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

interface UploadImageResult {
  provider: StorageProvider;
  url: string;
}

function getSupabaseToken(): string | null {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return SUPABASE_SERVICE_ROLE_KEY;
  }

  if (SUPABASE_ANON_KEY) {
    return SUPABASE_ANON_KEY;
  }

  return null;
}

function canUseSupabaseStorage(): boolean {
  return Boolean(SUPABASE_URL && getSupabaseToken());
}

function getSupabaseObjectPath(filename: string): string {
  return `article-covers/${filename}`;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function uploadToSupabase({
  buffer,
  filename,
  contentType
}: UploadImageOptions): Promise<UploadImageResult> {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  const token = getSupabaseToken();
  if (!token) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not configured");
  }

  const baseUrl = normalizeBaseUrl(SUPABASE_URL);
  const objectPath = getSupabaseObjectPath(filename);
  const uploadUrl = `${baseUrl}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "31536000"
    },
    body: new Uint8Array(buffer)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase Storage upload failed (${response.status}): ${errorText || "Unknown error"}`
    );
  }

  const publicUrl = `${baseUrl}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectPath}`;

  return {
    provider: "supabase",
    url: publicUrl
  };
}

async function uploadToVercelBlob({
  buffer,
  filename,
  contentType
}: UploadImageOptions): Promise<UploadImageResult> {
  if (!BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }

  const blob = await put(filename, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType
  });

  return {
    provider: "vercel-blob",
    url: blob.url
  };
}

export async function uploadGeneratedImage(options: UploadImageOptions): Promise<UploadImageResult> {
  if (canUseSupabaseStorage()) {
    return uploadToSupabase(options);
  }

  return uploadToVercelBlob(options);
}
