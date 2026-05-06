import type { APIRoute } from "astro";
import { STASH_URL, STASH_API_KEY, DEMO_MODE } from "astro:env/server";

const SERVER_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT = 10_000;
const MAX_CACHE_ENTRIES = 2000;

// Browser cache: serve fresh for 24 h, then stale-while-revalidate for 7 more days.
// `immutable` prevents any revalidation request while max-age is active.
const BROWSER_CACHE =
  "public, max-age=86400, stale-while-revalidate=604800, immutable";

interface CachedImage {
  data: ArrayBuffer;
  contentType: string;
  etag: string | null;
  timestamp: number;
}

// Insertion-ordered Map → oldest entry is always first → O(1) LRU eviction
const imageCache = new Map<string, CachedImage>();

function evict() {
  if (imageCache.size >= MAX_CACHE_ENTRIES) {
    imageCache.delete(imageCache.keys().next().value!);
  }
}

function cacheHeaders(contentType: string, etag: string | null): HeadersInit {
  const h: HeadersInit = {
    "Content-Type": contentType,
    "Cache-Control": BROWSER_CACHE,
    "Accept-Ranges": "bytes",
  };
  if (etag) (h as Record<string, string>)["ETag"] = etag;
  return h;
}

export const GET: APIRoute = async ({ request }) => {
  const imageUrl = new URL(request.url).searchParams.get("url");
  if (!imageUrl) return new Response("Bad Request", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // SSRF guard; only proxy requests to the configured Stash host
  if (!DEMO_MODE) {
    const stashBase = new URL(STASH_URL);
    if (
      parsed.hostname !== stashBase.hostname ||
      parsed.port !== stashBase.port ||
      parsed.protocol !== stashBase.protocol
    ) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Range requests (video streaming) bypass cache and proxy directly.
  // iOS Safari requires HTTP 206 + Accept-Ranges for any video playback.
  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) {
    const headers: Record<string, string> = { Range: rangeHeader };
    if (STASH_API_KEY) headers["ApiKey"] = STASH_API_KEY;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const upstream = await fetch(imageUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(tid);
      const respHeaders: Record<string, string> = {
        "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
        "Accept-Ranges": "bytes",
      };
      const cr = upstream.headers.get("content-range");
      const cl = upstream.headers.get("content-length");
      if (cr) respHeaders["Content-Range"] = cr;
      if (cl) respHeaders["Content-Length"] = cl;
      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
      });
    } catch {
      return new Response("Bad Gateway", { status: 502 });
    }
  }

  const clientEtag = request.headers.get("If-None-Match");

  const cached = imageCache.get(imageUrl);
  if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
    if (clientEtag && cached.etag && clientEtag === cached.etag) {
      return new Response(null, {
        status: 304,
        headers: cacheHeaders(cached.contentType, cached.etag),
      });
    }
    return new Response(cached.data, {
      headers: cacheHeaders(cached.contentType, cached.etag),
    });
  }

  const upstreamHeaders: Record<string, string> = {};
  if (STASH_API_KEY) upstreamHeaders["ApiKey"] = STASH_API_KEY;
  // Forward the client's ETag so Stash can 304 us if the image hasn't changed
  if (clientEtag) upstreamHeaders["If-None-Match"] = clientEtag;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const upstream = await fetch(imageUrl, {
      headers: upstreamHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Stash confirms image unchanged (our stale cache is still valid)
    if (upstream.status === 304) {
      if (cached) {
        cached.timestamp = Date.now(); // refresh TTL
        return new Response(null, {
          status: 304,
          headers: cacheHeaders(cached.contentType, cached.etag),
        });
      }
      // Server cache was evicted but Stash says 304 → client has valid copy
      return new Response(null, { status: 304 });
    }

    if (!upstream.ok) return new Response("Not Found", { status: 404 });

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const etag = upstream.headers.get("etag");
    const body = await upstream.arrayBuffer();

    evict();
    imageCache.set(imageUrl, {
      data: body,
      contentType,
      etag,
      timestamp: Date.now(),
    });

    return new Response(body, {
      headers: cacheHeaders(contentType, etag),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[/api/stash/image] fetch timed out:", imageUrl);
      return new Response("Gateway Timeout", { status: 504 });
    }
    console.error("[/api/stash/image] fetch failed:", imageUrl, err);
    return new Response("Bad Gateway", { status: 502 });
  }
};
