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
import { searchBySubreddit } from "@/lib/search/query";
import { getCommentCounts } from "@/lib/db/comment-counts";
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
  const subreddit = url.searchParams.get("subreddit") ?? undefined;

  let page = 1;
  // Stash reshuffles on every unseeded "random" query, so page 2 repeats page 1.
  // The seed rides in the cursor; the first request mints it.
  let seed = Date.now() & 0x7fffffff;

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    page = decoded.page;
    if (decoded.seed) seed = decoded.seed;
  }

  // Origin browse reads the local search index, not Stash
  if (subreddit) {
    const subSort = sort === "rating" || sort === "random" ? sort : "date";
    const result = searchBySubreddit(subreddit, "all", subSort, page, seed);
    const payload = {
      page,
      perPage: PER_PAGE,
      total: result.total,
      sort,
      seed: subSort === "random" ? seed : undefined,
      subreddit,
    };
    return new Response(
      JSON.stringify({
        items: result.items,
        cursor: encodeCursor(payload),
        nextCursor: result.hasMore ? nextCursor(payload) : null,
        total: result.total,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
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
    sort === "rating"
      ? "o_counter"
      : sort === "date"
        ? "created_at"
        : sort === "random"
          ? `random_${seed}`
          : sort;

  const sceneStashFilter: Record<string, unknown> = {
    page,
    per_page: TYPES_PER_PAGE,
    sort: stashSceneSort,
  };
  if (sort !== "random") sceneStashFilter.direction = "DESC";

  const buildImageFilter = (): Record<string, unknown> => {
    if (sort === "random")
      return { page, per_page: TYPES_PER_PAGE, sort: `random_${seed}` };
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

    // Local comment counts ride along on every item (in-media action rail)
    const commentMap = getCommentCounts([
      ...scenes.map((s) => s.id),
      ...images.map((i) => i.id),
    ]);
    for (const s of scenes) s.commentCount = commentMap.get(s.id) ?? 0;
    for (const i of images) i.commentCount = commentMap.get(i.id) ?? 0;

    if (sort === "rating") {
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

    const cursorPayload = {
      page,
      perPage: PER_PAGE,
      total: totalCount,
      sort,
      seed: sort === "random" ? seed : undefined,
      tagId,
      studioId,
      performerId,
    };

    const cursor = encodeCursor(cursorPayload);
    const next = nextCursor(cursorPayload);

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
