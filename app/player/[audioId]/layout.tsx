import type { Metadata } from "next";
import { getArticleSeoRecordByAudioId } from "@/lib/seo/article-metadata";
import {
  buildArticleOgImagePath,
  buildPageMetadata,
  trimDescription,
} from "@/lib/seo/metadata";

type PlayerLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ audioId: string }>;
};

export async function generateMetadata({ params }: PlayerLayoutProps): Promise<Metadata> {
  const { audioId } = await params;
  const parsedAudioId = Number.parseInt(audioId, 10);

  if (!Number.isFinite(parsedAudioId)) {
    return buildPageMetadata({
      title: "Audio Player",
      description: "Listen to your generated article narration in the TTS Reader player.",
      canonicalPath: "/player",
    });
  }

  try {
    const article = await getArticleSeoRecordByAudioId(parsedAudioId);

    if (!article) {
      return buildPageMetadata({
        title: "Audio Player",
        description: "Listen to your generated article narration in the TTS Reader player.",
        canonicalPath: `/player/${parsedAudioId}`,
      });
    }

    return buildPageMetadata({
      title: `Listen: ${article.title}`,
      description: trimDescription(
        `Listen to the AI-narrated version of this article. ${article.originalText}`,
        180
      ),
      canonicalPath: `/player/${parsedAudioId}`,
      ogImagePath: buildArticleOgImagePath(article.id, article.updatedAt),
    });
  } catch (error) {
    console.error("[SEO] Failed to generate metadata for player page:", error);

    return buildPageMetadata({
      title: "Audio Player",
      description: "Listen to your generated article narration in the TTS Reader player.",
      canonicalPath: `/player/${parsedAudioId}`,
    });
  }
}

export default function PlayerLayout({ children }: PlayerLayoutProps) {
  return children;
}
