const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v2/scrape";

export interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      [key: string]: any;
    };
  };
  error?: string;
}

export async function scrapeArticle(url: string): Promise<FirecrawlResponse> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        maxAge: 172800000,
        formats: ["markdown"],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();

    // V2 API returns { success: true, data: { markdown, metadata, ... } }
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          markdown: result.data.markdown || "",
          html: result.data.html || result.data.rawHtml || "",
          metadata: result.data.metadata || {},
        },
      };
    }

    return {
      success: false,
      error: result.error || "Failed to scrape article",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export function extractWordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Intelligently extract featured image from metadata
 * Priority: og:image > twitter:image > first image in content
 */
export function extractFeaturedImage(metadata: Record<string, any>): string | null {
  if (!metadata) return null;

  // Priority 1: Open Graph image
  if (metadata.ogImage || metadata['og:image']) {
    const ogImage = metadata.ogImage || metadata['og:image'];
    // Handle array or string
    if (Array.isArray(ogImage) && ogImage.length > 0) {
      return ogImage[0].url || ogImage[0];
    }
    if (typeof ogImage === 'string') return ogImage;
    if (ogImage?.url) return ogImage.url;
  }

  // Priority 2: Twitter image
  if (metadata.twitterImage || metadata['twitter:image']) {
    const twitterImage = metadata.twitterImage || metadata['twitter:image'];
    if (typeof twitterImage === 'string') return twitterImage;
    if (twitterImage?.url) return twitterImage.url;
  }

  // Priority 3: Schema.org image
  if (metadata.image) {
    if (typeof metadata.image === 'string') return metadata.image;
    if (Array.isArray(metadata.image) && metadata.image.length > 0) {
      return metadata.image[0].url || metadata.image[0];
    }
    if (metadata.image?.url) return metadata.image.url;
  }

  // Priority 4: Generic meta image tag
  if (metadata.metaImage) {
    return metadata.metaImage;
  }

  return null;
}
