/**
 * Image Generation Utilities
 * Color schemes, prompt building, and image generation helpers for AI-generated article covers
 */

export const CATEGORY_COLOR_SCHEMES: Record<string, string> = {
  Technology: "terminal green (#00ff88), cyan (#00d4ff), dark navy blue",
  News: "purple (#a855f7), pink (#ec4899), charcoal gray",
  Politics: "purple (#a855f7), pink (#ec4899), charcoal gray",
  Business: "royal blue (#3b82f6), orange, slate gray",
  Science: "cyan (#00d4ff), teal, white",
  Culture: "pink (#ec4899), peach, cream",
  Lifestyle: "pink (#ec4899), peach, cream",
  Entertainment: "pink (#ec4899), peach, cream",
  Sports: "orange (#fb923c), yellow, black",
  Health: "green (#10b981), mint, white",
  default: "terminal green (#00ff88), white, black"
};

/**
 * Extract key subject from article title by removing stop words
 */
function extractKeySubject(title: string): string {
  const stopWords = ['the', 'a', 'an', 'of', 'in', 'to', 'for', 'and', 'or', 'is', 'are', 'at', 'by', 'on', 'with', 'from', 'as'];
  return title
    .split(' ')
    .filter(word => !stopWords.includes(word.toLowerCase()))
    .slice(0, 5)
    .join(' ');
}

/**
 * Build a detailed image generation prompt based on article metadata
 */
export function buildImagePrompt(article: {
  title: string;
  categories: string[];
  summary?: string;
}): string {
  const primaryCategory = article.categories[0] || "default";
  const colorScheme = CATEGORY_COLOR_SCHEMES[primaryCategory] || CATEGORY_COLOR_SCHEMES.default;
  const subject = extractKeySubject(article.title);
  const contextSnippet = article.summary?.slice(0, 200) || article.title;

  return `
Editorial illustration in a modern minimalist style with bold geometric shapes.

Subject: ${subject}

Style: Flat design with overlapping shapes, clean lines, subtle paper texture.
Limited color palette: ${colorScheme}.
Professional, sophisticated composition. No text, typography, or words.
Abstract representation of: ${contextSnippet}

Aspect: 3:4 portrait orientation
  `.trim();
}

/**
 * Generate a filename for a generated image
 */
export function generateImageFilename(articleId: number): string {
  return `article-${articleId}-${Date.now()}.jpg`;
}
