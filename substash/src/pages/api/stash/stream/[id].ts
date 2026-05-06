import type { APIRoute } from "astro";
import { STASH_URL, STASH_API_KEY } from "astro:env/server";

const PASSTHROUGH = [
  "Content-Type",
  "Content-Length",
  "Content-Range",
  "Accept-Ranges",
];

export const GET: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id || !/^\d+$/.test(id))
    return new Response("Bad request", { status: 400 });

  const upstreamHeaders: Record<string, string> = {};
  if (STASH_API_KEY) upstreamHeaders["ApiKey"] = STASH_API_KEY;

  const range = request.headers.get("Range");
  if (range) upstreamHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(`${STASH_URL}/scene/${id}/stream`, {
      headers: upstreamHeaders,
    });
  } catch {
    return new Response("Upstream unavailable", { status: 502 });
  }

  const headers = new Headers();
  for (const h of PASSTHROUGH) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");

  return new Response(upstream.body, { status: upstream.status, headers });
};
