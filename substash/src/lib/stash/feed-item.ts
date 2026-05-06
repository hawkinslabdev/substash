import type { StashScene, StashImage, Maybe } from "./types";
import { resolveTitle, formatOriginDisplay } from "@/lib/utils/subreddit";
import { getFeedSettings } from "@/lib/settings/feed";

type Nullable<T> = T | null;

export type FeedItemType = "scene" | "image";

export interface BaseFeedItem {
  id: string;
  type: FeedItemType;
  title: string | null;
  subreddit: string;
  subredditDisplay: string;
  originDisplay: string;
  date: string | null;
  studio: { id: string; name: string; image_path: string | null } | null;
  performers: { id: string; name: string; image_path: string | null }[];
  tags: { id: string; name: string }[];
  metaPerformer: string | null;
  metaOrigin: string | null;
  metaCredit: string | null;
  metaDay: string | null;
}

export interface SceneFeedItem extends BaseFeedItem {
  type: "scene";
  paths: {
    stream: string | null;
    screenshot: string | null;
    preview: string | null;
  };
  rating100: number | null;
  o_counter: number | null;
  play_count: number | null;
  files: { width: number; height: number; duration: number }[];
}

export interface ImageFeedItem extends BaseFeedItem {
  type: "image";
  paths: {
    thumbnail: string | null;
    preview: string | null;
  };
  rating100: number | null;
  o_counter: number | null;
  directUrl: string | null;
  files: { width: number; height: number }[];
}

export type FeedItem = SceneFeedItem | ImageFeedItem;

function normalizeStudio(
  studio: Maybe<{ id: string; name: string }>,
): { id: string; name: string; image_path: string | null } | null {
  if (!studio) return null;
  return {
    id: studio.id,
    name: studio.name,
    image_path: null, // StashImage studio doesn't have image_path
  };
}

function normalizePerformers(
  performers: { id: string; name: string; image_path: Maybe<string> }[],
): { id: string; name: string; image_path: string | null }[] {
  return performers.map((p) => ({
    id: p.id,
    name: p.name,
    image_path: p.image_path ?? null,
  }));
}

export function sceneToFeedItem(scene: StashScene): SceneFeedItem {
  const sub = resolveTitle(scene.title, scene.files[0]?.path, null, {
    studio: scene.studio?.name ?? null,
    performers: scene.performers.map((p) => p.name),
    tags: scene.tags.map((t) => t.name),
    date: scene.date || scene.created_at?.substring(0, 10) || null,
    rating: scene.rating100 ?? null,
  });
  const { showPrefix } = getFeedSettings();
  return {
    id: scene.id,
    type: "scene",
    title: sub.cleanTitle || null,
    subreddit: sub.subreddit,
    subredditDisplay: sub.displayName,
    originDisplay: formatOriginDisplay(sub.origin, sub.displayName, showPrefix),
    date: scene.date || scene.created_at?.substring(0, 10) || null,
    studio: normalizeStudio(scene.studio),
    performers: normalizePerformers(scene.performers),
    tags: scene.tags,
    metaPerformer: sub.performer,
    metaOrigin: sub.origin,
    metaCredit: sub.credit,
    metaDay: sub.day,
    paths: {
      stream: scene.paths.stream ? `/api/stash/stream/${scene.id}` : null,
      screenshot: scene.paths.screenshot || null,
      preview: scene.paths.preview || null,
    },
    rating100: scene.rating100 ?? null,
    o_counter: scene.o_counter ?? null,
    play_count: scene.play_count ?? null,
    files: scene.files.map((f) => ({
      width: f.width,
      height: f.height,
      duration: f.duration,
    })),
  };
}

export function imageToFeedItem(image: StashImage): ImageFeedItem {
  const fileSource = image.files[0] ?? image.visual_files?.[0];
  const sub = resolveTitle(
    image.title,
    fileSource?.path,
    fileSource?.basename,
    {
      studio: image.studio?.name ?? null,
      performers: image.performers.map((p) => p.name),
      tags: image.tags.map((t) => t.name),
      date: image.date || image.created_at?.substring(0, 10) || null,
      rating: image.rating100 ?? null,
    },
  );
  const { showPrefix } = getFeedSettings();
  return {
    id: image.id,
    type: "image",
    title: sub.cleanTitle || null,
    subreddit: sub.subreddit,
    subredditDisplay: sub.displayName,
    originDisplay: formatOriginDisplay(sub.origin, sub.displayName, showPrefix),
    date: image.date || image.created_at?.substring(0, 10) || null,
    studio: normalizeStudio(image.studio),
    performers: normalizePerformers(image.performers),
    tags: image.tags,
    metaPerformer: sub.performer,
    metaOrigin: sub.origin,
    metaCredit: sub.credit,
    metaDay: sub.day,
    paths: {
      thumbnail: image.paths.thumbnail || null,
      preview: image.paths.preview || null,
    },
    rating100: image.rating100 ?? null,
    o_counter: image.o_counter ?? null,
    directUrl: null,
    files: image.files.map((f) => ({
      width: f.width,
      height: f.height,
    })),
  };
}
