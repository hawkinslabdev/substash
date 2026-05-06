import type { APIRoute } from "astro";
import { DEMO_MODE } from "astro:env/server";
import { demoStudiosResponse } from "@/lib/demo";
import { stashRequest } from "@/lib/stash/client";
import { FIND_STUDIOS } from "@/lib/stash/queries";
import type { FindStudiosQuery } from "@/lib/stash/types";

export const GET: APIRoute = async ({ request }) => {
  if (DEMO_MODE) return demoStudiosResponse();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const per_page = parseInt(url.searchParams.get("per_page") ?? "100", 10);

  const data = await stashRequest<FindStudiosQuery>(FIND_STUDIOS, {
    filter: { page, per_page, sort: "scene_count", direction: "DESC" },
  });

  return new Response(JSON.stringify(data.findStudios), {
    headers: { "Content-Type": "application/json" },
  });
};
