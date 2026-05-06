import type { APIRoute } from "astro";
import { STASH_URL } from "astro:env/server";

const ALLOWED_TYPES = new Set(["scene", "scenes", "image", "images"]);

export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if (!type || !id || !ALLOWED_TYPES.has(type) || !/^\d+$/.test(id)) {
    return new Response("Bad request", { status: 400 });
  }

  const segment =
    type === "scene" ? "scenes" : type === "image" ? "images" : type;
  return Response.redirect(`${STASH_URL}/${segment}/${id}`, 302);
};
