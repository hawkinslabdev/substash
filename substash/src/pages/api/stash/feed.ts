import type { APIRoute } from "astro";
import { DEMO_MODE } from "astro:env/server";
import { demoFeedResponse } from "@/lib/demo";
import { stashRequest } from "@/lib/stash/client";
import { FIND_SCENES, FIND_IMAGES } from "@/lib/stash/queries";
import type { FindScenesQuery, FindImagesQuery } from "@/lib/stash/types";
import {
  sceneToFeedItem,
  imageToFeedItem,
  type FeedItem,
  type SceneFeedItem,
  type ImageFeedItem,
} from "@/lib/stash/feed-item";
import { encodeCursor, decodeCursor, nextCursor } from "@/lib/utils/cursor";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { count, inArray } from "drizzle-orm";
import { filterByTags } from "@/lib/stash/filter";

const PER_PAGE = 20;
const TYPES_PER_PAGE = Math.floor(PER_PAGE / 2); // 10 scenes + 10 images

function compositeScore(
  rating100: number | null,
  oCounter: number | null,
  commentCount: number,
): number {
  const r = (rating100 ?? 0) / 100;
  const o = Math.min(oCounter ?? 0, 50) / 50;
  const c = Math.min(commentCount, 10) / 10;
  return r * 0.5 + o * 0.45 + c * 0.05;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const cursorParam = url.searchParams.get("cursor");
  const sort = url.searchParams.get("sort") ?? "date";

  if (DEMO_MODE) return demoFeedResponse(cursorParam, sort);
  const tagId = url.searchParams.get("tag") ?? undefined;
  const studioId = url.searchParams.get("studio") ?? undefined;
  const performerId = url.searchParams.get("performer") ?? undefined;

  let page = 1;

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    page = decoded.page;
  }

  const sceneFilter: Record<string, unknown> = {};
  if (tagId) sceneFilter.tags = { value: [tagId], modifier: "INCLUDES" };
  if (studioId)
    sceneFilter.studios = { value: [studioId], modifier: "INCLUDES" };
  if (performerId)
    sceneFilter.performers = { value: [performerId], modifier: "INCLUDES" };

  const imageFilter: Record<string, unknown> = {};
  if (tagId) imageFilter.tags = { value: [tagId], modifier: "INCLUDES" };
  if (studioId)
    imageFilter.studios = { value: [studioId], modifier: "INCLUDES" };
  if (performerId)
    imageFilter.performers = { value: [performerId], modifier: "INCLUDES" };

  const stashSceneSort =
    sort === "rating" ? "o_counter" : sort === "date" ? "created_at" : sort;

  const sceneStashFilter: Record<string, unknown> = {
    page,
    per_page: TYPES_PER_PAGE,
    sort: stashSceneSort,
  };
  if (sort !== "random") sceneStashFilter.direction = "DESC";

  const buildImageFilter = (): Record<string, unknown> => {
    if (sort === "random")
      return { page, per_page: TYPES_PER_PAGE, sort: "random" };
    if (sort === "rating")
      return {
        page,
        per_page: TYPES_PER_PAGE,
        sort: "o_counter",
        direction: "DESC",
      };
    return {
      page,
      per_page: TYPES_PER_PAGE,
      sort: "created_at",
      direction: "DESC",
    };
  };

  try {
    let stashError = false;
    const [scenesData, imagesData] = await Promise.all([
      stashRequest<FindScenesQuery>(FIND_SCENES, {
        filter: sceneStashFilter,
        scene_filter: Object.keys(sceneFilter).length ? sceneFilter : undefined,
      }).catch((e) => {
        console.error("[feed] scenes fetch failed:", e);
        stashError = true;
        return { findScenes: { count: 0, scenes: [] } };
      }),
      stashRequest<FindImagesQuery>(FIND_IMAGES, {
        filter: buildImageFilter(),
        image_filter: Object.keys(imageFilter).length ? imageFilter : undefined,
      }).catch((e) => {
        console.error("[feed] images fetch failed:", e);
        stashError = true;
        return { findImages: { count: 0, images: [] } };
      }),
    ]);

    // Filter out media with excluded tags
    const filteredScenes = filterByTags(scenesData.findScenes.scenes);
    const filteredImages = filterByTags(imagesData.findImages.images);

    let scenes: SceneFeedItem[] = filteredScenes.map(sceneToFeedItem);
    let images: ImageFeedItem[] = filteredImages.map(imageToFeedItem);

    const totalCount =
      scenesData.findScenes.count + imagesData.findImages.count;

    if (sort === "rating") {
      const allIds = [...scenes.map((s) => s.id), ...images.map((i) => i.id)];
      let commentMap = new Map<string, number>();
      if (allIds.length > 0) {
        const rows = await db
          .select({ stashId: comments.stashId, n: count() })
          .from(comments)
          .where(inArray(comments.stashId, allIds))
          .groupBy(comments.stashId);
        commentMap = new Map(rows.map((r) => [r.stashId, r.n]));
      }
      scenes = scenes.sort(
        (a, b) =>
          compositeScore(b.rating100, b.o_counter, commentMap.get(b.id) ?? 0) -
          compositeScore(a.rating100, a.o_counter, commentMap.get(a.id) ?? 0),
      );
      images = images.sort(
        (a, b) =>
          compositeScore(b.rating100, b.o_counter, commentMap.get(b.id) ?? 0) -
          compositeScore(a.rating100, a.o_counter, commentMap.get(a.id) ?? 0),
      );
    }

    const items: FeedItem[] = [];
    const maxLen = Math.max(scenes.length, images.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < scenes.length) items.push(scenes[i]);
      if (i < images.length) items.push(images[i]);
    }

    const cursor = encodeCursor({
      page,
      perPage: PER_PAGE,
      total: totalCount,
      sort,
      tagId,
      studioId,
      performerId,
    });

    const next = nextCursor({
      page,
      perPage: PER_PAGE,
      total: totalCount,
      sort,
      tagId,
      studioId,
      performerId,
    });

    return new Response(
      JSON.stringify({
        items,
        cursor,
        nextCursor: next,
        total: totalCount,
        stashError,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(
      "[/api/stash/feed] failed: sort:",
      sort,
      "error:",
      err instanceof Error ? err.message : err,
    );
    return new Response(JSON.stringify({ error: "Stash unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
};
