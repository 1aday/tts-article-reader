const REPLICATE_DELIVERY_HOST = "replicate.delivery";

export function isTemporaryReplicateImageUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === REPLICATE_DELIVERY_HOST ||
      parsedUrl.hostname.endsWith(`.${REPLICATE_DELIVERY_HOST}`)
    );
  } catch {
    return false;
  }
}

export function hasPersistentGeneratedImage(url: string | null | undefined): boolean {
  return Boolean(url) && !isTemporaryReplicateImageUrl(url);
}
