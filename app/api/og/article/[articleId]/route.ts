import { buildArticleOgImage } from "@/lib/seo/og-image";
import { getArticleSeoRecordById } from "@/lib/seo/article-metadata";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

const resolveSourceHost = (sourceUrl: string | null): string | null => {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const parsedArticleId = Number.parseInt(articleId, 10);

    if (!Number.isFinite(parsedArticleId)) {
      return new Response("Invalid article id", { status: 400 });
    }

    const article = await getArticleSeoRecordById(parsedArticleId);

    if (!article) {
      const fallback = await buildArticleOgImage({
        title: "Article not found",
      });
      const payload = new Uint8Array(fallback);

      return new Response(payload, {
        status: 404,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": CACHE_CONTROL,
          "Content-Length": String(payload.byteLength),
        },
      });
    }

    const sourceImageUrl = hasPersistentGeneratedImage(article.generatedImageUrl)
      ? article.generatedImageUrl
      : article.imageUrl;

    const image = await buildArticleOgImage({
      title: article.title,
      sourceImageUrl,
      sourceHost: resolveSourceHost(article.sourceUrl),
    });
    const payload = new Uint8Array(image);

    return new Response(payload, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
        "Content-Length": String(payload.byteLength),
      },
    });
  } catch (error) {
    console.error("[OG Article] Failed to render OG image:", error);

    try {
      const fallback = await buildArticleOgImage({ title: "TTS Reader Article" });
      const payload = new Uint8Array(fallback);
      return new Response(payload, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": CACHE_CONTROL,
          "Content-Length": String(payload.byteLength),
        },
      });
    } catch {
      return new Response("Failed to render OG image", { status: 500 });
    }
  }
}
