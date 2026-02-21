import { buildHomeOgImage } from "@/lib/seo/og-image";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function GET() {
  try {
    const image = await buildHomeOgImage();
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
