import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const upstreamUrl = rawUrl.startsWith("/")
      ? `${request.nextUrl.origin}${rawUrl}`
      : rawUrl;

    const range = request.headers.get("range");
    const upstreamHeaders = new Headers();
    if (range) {
      upstreamHeaders.set("range", range);
    }

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => "");
      const responseHeaders = new Headers({
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Range",
        "Cross-Origin-Resource-Policy": "cross-origin",
      });

      return new NextResponse(
        errorPayload || JSON.stringify({ error: "Failed to fetch audio file" }),
        {
          status: response.status,
          headers: responseHeaders,
        }
      );
    }

    const responseHeaders = new Headers();
    const passthroughHeaderNames = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
    ];

    for (const headerName of passthroughHeaderNames) {
      const headerValue = response.headers.get(headerName);
      if (headerValue) {
        responseHeaders.set(headerName, headerValue);
      }
    }

    if (!responseHeaders.has("content-type")) {
      responseHeaders.set("content-type", "audio/mpeg");
    }
    if (!responseHeaders.has("accept-ranges")) {
      responseHeaders.set("accept-ranges", "bytes");
    }
    if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("cache-control", "public, max-age=3600");
    }

    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Audio proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audio file' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
