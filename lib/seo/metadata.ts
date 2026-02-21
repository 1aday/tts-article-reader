import type { Metadata } from "next";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/seo/og-image";

export const SITE_NAME = "TTS Reader";
export const SITE_DESCRIPTION =
  "Convert any article into cinematic, natural-sounding audio with AI voice generation.";

const resolveSiteOrigin = (): string => {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const normalized = candidate.startsWith("http://") || candidate.startsWith("https://")
      ? candidate
      : `https://${candidate}`;

    try {
      return new URL(normalized).origin;
    } catch {
      continue;
    }
  }

  return "http://localhost:3000";
};

const HOME_OG_PATH = "/api/og/home";

export const metadataBase = new URL(resolveSiteOrigin());

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

export const trimDescription = (value: string | null | undefined, maxLength = 180): string => {
  if (!value) return SITE_DESCRIPTION;

  const normalized = normalizeText(value);
  if (!normalized) return SITE_DESCRIPTION;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
};

export const buildArticleOgImagePath = (
  articleId: number,
  updatedAt: Date | string | null | undefined
): string => {
  const stamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return `/api/og/article/${articleId}?v=${stamp}`;
};

const buildImageMetadata = (path: string, alt: string) => ({
  url: path,
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  type: "image/jpeg",
  alt,
});

export const buildRootMetadata = (): Metadata => ({
  metadataBase,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [buildImageMetadata(HOME_OG_PATH, `${SITE_NAME} home preview`)],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [HOME_OG_PATH],
  },
});

type PageMetadataInput = {
  title: string;
  description: string;
  canonicalPath: string;
  ogImagePath?: string;
};

export const buildPageMetadata = ({
  title,
  description,
  canonicalPath,
  ogImagePath = HOME_OG_PATH,
}: PageMetadataInput): Metadata => ({
  title,
  description,
  alternates: {
    canonical: canonicalPath,
  },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title,
    description,
    url: canonicalPath,
    images: [buildImageMetadata(ogImagePath, `${title} preview`)],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImagePath],
  },
});
