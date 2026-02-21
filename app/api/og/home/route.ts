import { desc, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { buildHomeOgImage } from "@/lib/seo/og-image";
import { hasPersistentGeneratedImage } from "@/lib/utils/image-url";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function GET() {
  try {
    const recentCovers = await db
      .select({
        imageUrl: articles.imageUrl,
        generatedImageUrl: articles.generatedImageUrl,
      })
      .from(articles)
      .where(or(isNotNull(articles.generatedImageUrl), isNotNull(articles.imageUrl)))
      .orderBy(desc(articles.updatedAt), desc(articles.createdAt))
      .limit(9);

    const coverImageUrls = recentCovers
      .map((article) =>
        hasPersistentGeneratedImage(article.generatedImageUrl)
          ? article.generatedImageUrl
          : article.imageUrl
      )
      .filter((url): url is string => Boolean(url));

    const image = await buildHomeOgImage({ coverImageUrls });
    const payload = new Uint8Array(image);

    return new Response(payload, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
        "Content-Length": String(payload.byteLength),
      },
    });
  } catch (error) {
    console.error("[OG Home] Failed to render OG image:", error);
    return new Response("Failed to render OG image", { status: 500 });
  }
}
