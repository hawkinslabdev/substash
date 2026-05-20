import type { APIRoute } from "astro";
import { isIndexEmpty, getSyncState } from "@/lib/search/sync";
import {
  searchMedia,
  searchEntities,
  searchComments,
  type FilterType,
} from "@/lib/search/query";
import { encodeCursor, decodeCursor } from "@/lib/utils/cursor";

const MIN_QUERY = 2;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const type = (url.searchParams.get("type") ?? "all") as FilterType;
  const cursorParam = url.searchParams.get("cursor");

  if (q.length < MIN_QUERY) {
    return json({
      items: [],
      entities: [],
      commentHits: [],
      nextCursor: null,
      total: 0,
    });
  }

  if (isIndexEmpty()) {
    const state = getSyncState();
    return json({
      items: [],
      entities: [],
      commentHits: [],
      nextCursor: null,
      total: 0,
      syncing: true,
      syncInProgress: state.inProgress,
    });
  }

  let page = 1;
  if (cursorParam) {
    page = decodeCursor(cursorParam).page;
  }

  if (type === "comments") {
    const result = searchComments(q, page);
    return json({
      items: [],
      entities: [],
      commentHits: result.hits,
      nextCursor: result.hasMore
        ? encodeCursor({
            page: page + 1,
            perPage: 20,
            total: result.total,
            sort: "search",
            q,
            mediaType: type,
          })
        : null,
      total: result.total,
    });
  }

  if (type === "tags" || type === "performers" || type === "studios") {
    const entityType =
      type === "tags" ? "tag" : type === "performers" ? "performer" : "studio";
    const result = searchEntities(q, entityType, page);
    return json({
      items: [],
      entities: result.entities,
      commentHits: [],
      nextCursor: result.hasMore
        ? encodeCursor({
            page: page + 1,
            perPage: 20,
            total: result.total,
            sort: "search",
            q,
            mediaType: type,
          })
        : null,
      total: result.total,
    });
  }

  // all | scenes | images
  const result = searchMedia(q, type as "all" | "scenes" | "images", page);
  return json({
    items: result.items,
    entities: [],
    commentHits: [],
    nextCursor: result.hasMore
      ? encodeCursor({
          page: page + 1,
          perPage: 20,
          total: result.total,
          sort: "search",
          q,
          mediaType: type,
        })
      : null,
    total: result.total,
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
