const METADATA_MIN_TRUST_RATIO = 0.8;
const METADATA_MAX_TRUST_RATIO = 1.25;
const MAX_METADATA_EXTENSION_RATIO = 8;
const MAX_REASONABLE_METADATA_DURATION_SECONDS = 24 * 60 * 60;

const warnedDurationMismatches = new Set<string>();

const toPositiveFinite = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) return 0;
  return value! > 0 ? value! : 0;
};

const toNonNegativeFinite = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) return 0;
  return value! >= 0 ? value! : 0;
};

interface ResolvePlaybackDurationOptions {
  trustedDuration?: number | null;
  metadataDuration?: number | null;
  currentTime?: number | null;
  trackId?: number | string | null;
  logPrefix?: string;
}

function warnMetadataMismatchOnce(options: {
  trackId: number | string | null | undefined;
  trustedDuration: number;
  metadataDuration: number;
  ratio: number;
  logPrefix?: string;
}) {
  const { trackId, trustedDuration, metadataDuration, ratio, logPrefix } = options;
  const mismatchKey = `${trackId ?? "unknown"}:${trustedDuration.toFixed(3)}:${metadataDuration.toFixed(3)}`;

  if (warnedDurationMismatches.has(mismatchKey)) {
    return;
  }

  warnedDurationMismatches.add(mismatchKey);

  console.warn(
    `${logPrefix ?? "[Player]"} Metadata duration mismatch detected.`,
    {
      trackId: trackId ?? null,
      trustedDuration,
      metadataDuration,
      ratio,
    },
  );
}

export function resolvePlaybackDurationSeconds(
  options: ResolvePlaybackDurationOptions,
): number {
  const trustedDuration = toPositiveFinite(options.trustedDuration);
  const metadataDuration = toPositiveFinite(options.metadataDuration);
  const currentTime = toNonNegativeFinite(options.currentTime);

  let resolvedDuration = 0;

  if (trustedDuration > 0) {
    resolvedDuration = trustedDuration;

    if (metadataDuration > 0) {
      const ratio = metadataDuration / trustedDuration;
      const metadataLooksMismatched =
        ratio < METADATA_MIN_TRUST_RATIO || ratio > METADATA_MAX_TRUST_RATIO;

      if (metadataLooksMismatched) {
        warnMetadataMismatchOnce({
          trackId: options.trackId,
          trustedDuration,
          metadataDuration,
          ratio,
          logPrefix: options.logPrefix,
        });
      }

      const metadataLooksLikeReasonableExtension =
        metadataDuration > trustedDuration &&
        ratio <= MAX_METADATA_EXTENSION_RATIO &&
        metadataDuration <= MAX_REASONABLE_METADATA_DURATION_SECONDS;

      if (!metadataLooksMismatched || metadataLooksLikeReasonableExtension) {
        resolvedDuration = metadataDuration;
      }
    }
  } else if (metadataDuration > 0) {
    resolvedDuration = metadataDuration;
  }

  // Never allow the resolved duration to move behind playback position.
  return Math.max(resolvedDuration, currentTime);
}

export function getSeekUpperBoundSeconds(
  durationSeconds: number | null | undefined,
  currentTimeSeconds: number | null | undefined,
): number {
  const safeDuration = toPositiveFinite(durationSeconds);
  const safeCurrentTime = toNonNegativeFinite(currentTimeSeconds);

  if (safeDuration > 0) {
    return Math.max(safeDuration, safeCurrentTime);
  }

  // When duration is unknown, do not allow forward seeking past current time.
  return safeCurrentTime;
}
