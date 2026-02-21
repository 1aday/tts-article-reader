function getFilenameFromContentDisposition(
  contentDisposition: string | null,
  fallback: string,
): string {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // Fall through to other filename parsing.
    }
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(contentDisposition);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = /filename=([^;]+)/i.exec(contentDisposition);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return fallback;
}

function buildDownloadUrl(audioId: number): string {
  return `/api/audio/${audioId}/download`;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod|android|mobile/.test(userAgent) || isTouchMac;
}

export async function downloadAudioFile(audioId: number): Promise<void> {
  if (!Number.isFinite(audioId) || audioId <= 0) {
    throw new Error("Invalid audio id");
  }

  const downloadUrl = buildDownloadUrl(audioId);

  // Mobile browsers can fail or OOM when buffering large blobs in JS.
  // Let the browser handle the file stream directly from our download endpoint.
  if (isMobileBrowser()) {
    window.location.assign(downloadUrl);
    return;
  }

  const response = await fetch(downloadUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Failed to download audio";
    const responseType = response.headers.get("content-type") || "";

    try {
      if (responseType.includes("application/json")) {
        const payload = await response.json() as { error?: string };
        if (payload?.error) {
          message = payload.error;
        }
      } else {
        const text = await response.text();
        if (text) {
          message = text;
        }
      }
    } catch {
      // Keep default message if parsing fails.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  if (!(blob.size > 0)) {
    throw new Error("Downloaded audio is empty");
  }

  const fallbackFilename = `audio-${audioId}.mp3`;
  const filename = getFilenameFromContentDisposition(
    response.headers.get("content-disposition"),
    fallbackFilename,
  );

  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
