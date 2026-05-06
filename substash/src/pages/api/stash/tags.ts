import type { APIRoute } from "astro";
import { DEMO_MODE } from "astro:env/server";
import { demoTagsResponse } from "@/lib/demo";
import { stashRequest } from "@/lib/stash/client";
import { FIND_TAGS } from "@/lib/stash/queries";
import type { FindTagsQuery } from "@/lib/stash/types";
import { filterTagList } from "@/lib/stash/filter";

export const GET: APIRoute = async ({ request }) => {
  if (DEMO_MODE) return demoTagsResponse();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const per_page = parseInt(url.searchParams.get("per_page") ?? "100", 10);

  const data = await stashRequest<FindTagsQuery>(FIND_TAGS, {
    filter: { page, per_page, sort: "scene_count", direction: "DESC" },
  });

  // Filter out excluded tags
  const filteredTags = filterTagList(data.findTags.tags);

  return new Response(
    JSON.stringify({
      count: filteredTags.length,
      tags: filteredTags,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};
