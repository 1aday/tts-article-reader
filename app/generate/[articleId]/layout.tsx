import type { Metadata } from "next";
import { getArticleSeoRecordById } from "@/lib/seo/article-metadata";
import {
  buildArticleOgImagePath,
  buildPageMetadata,
  trimDescription,
} from "@/lib/seo/metadata";

type GenerateLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ articleId: string }>;
};

export async function generateMetadata({ params }: GenerateLayoutProps): Promise<Metadata> {
  const { articleId } = await params;
  const parsedArticleId = Number.parseInt(articleId, 10);

  if (!Number.isFinite(parsedArticleId)) {
    return buildPageMetadata({
      title: "Generate Audio",
      description: "Generate cinematic AI narration from your article text.",
      canonicalPath: "/generate",
    });
  }

  try {
    const article = await getArticleSeoRecordById(parsedArticleId);

    if (!article) {
      return buildPageMetadata({
        title: "Generate Audio",
        description: "Generate cinematic AI narration from your article text.",
        canonicalPath: `/generate/${parsedArticleId}`,
      });
    }

    return buildPageMetadata({
      title: `Generating: ${article.title}`,
      description: trimDescription(
        `Audio generation in progress for this article. ${article.originalText}`,
        180
      ),
      canonicalPath: `/generate/${parsedArticleId}`,
      ogImagePath: buildArticleOgImagePath(parsedArticleId, article.updatedAt),
    });
  } catch (error) {
    console.error("[SEO] Failed to generate metadata for generate page:", error);

    return buildPageMetadata({
      title: "Generate Audio",
      description: "Generate cinematic AI narration from your article text.",
      canonicalPath: `/generate/${parsedArticleId}`,
    });
  }
}

export default function GenerateLayout({ children }: GenerateLayoutProps) {
  return children;
}
