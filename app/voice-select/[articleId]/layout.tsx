import type { Metadata } from "next";
import { getArticleSeoRecordById } from "@/lib/seo/article-metadata";
import {
  buildArticleOgImagePath,
  buildPageMetadata,
  trimDescription,
} from "@/lib/seo/metadata";

type VoiceSelectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ articleId: string }>;
};

export async function generateMetadata({
  params,
}: VoiceSelectLayoutProps): Promise<Metadata> {
  const { articleId } = await params;
  const parsedArticleId = Number.parseInt(articleId, 10);

  if (!Number.isFinite(parsedArticleId)) {
    return buildPageMetadata({
      title: "Select Voice",
      description: "Choose a voice and generate cinematic audio for your article.",
      canonicalPath: "/voice-select",
    });
  }

  try {
    const article = await getArticleSeoRecordById(parsedArticleId);

    if (!article) {
      return buildPageMetadata({
        title: "Select Voice",
        description: "Choose a voice and generate cinematic audio for your article.",
        canonicalPath: `/voice-select/${parsedArticleId}`,
      });
    }

    return buildPageMetadata({
      title: `Select Voice: ${article.title}`,
      description: trimDescription(
        `Choose the perfect AI voice for this article. ${article.originalText}`,
        180
      ),
      canonicalPath: `/voice-select/${parsedArticleId}`,
      ogImagePath: buildArticleOgImagePath(parsedArticleId, article.updatedAt),
    });
  } catch (error) {
    console.error("[SEO] Failed to generate metadata for voice select page:", error);

    return buildPageMetadata({
      title: "Select Voice",
      description: "Choose a voice and generate cinematic audio for your article.",
      canonicalPath: `/voice-select/${parsedArticleId}`,
    });
  }
}

export default function VoiceSelectLayout({ children }: VoiceSelectLayoutProps) {
  return children;
}
