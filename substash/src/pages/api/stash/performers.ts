import type { APIRoute } from "astro";
import { DEMO_MODE } from "astro:env/server";
import { demoPerformersResponse } from "@/lib/demo";
import { stashRequest } from "@/lib/stash/client";
import { FIND_PERFORMERS } from "@/lib/stash/queries";
import type { FindPerformersQuery } from "@/lib/stash/types";

export const GET: APIRoute = async ({ request }) => {
  if (DEMO_MODE) return demoPerformersResponse();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const per_page = parseInt(url.searchParams.get("per_page") ?? "100", 10);

  const data = await stashRequest<FindPerformersQuery>(FIND_PERFORMERS, {
    filter: { page, per_page, sort: "scene_count", direction: "DESC" },
  });

  return new Response(JSON.stringify(data.findPerformers), {
    headers: { "Content-Type": "application/json" },
  });
};
