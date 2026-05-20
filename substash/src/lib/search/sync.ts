import { rawDb } from "@/lib/db";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { stashRequest } from "@/lib/stash/client";
import {
  FIND_SCENES,
  FIND_IMAGES,
  FIND_TAGS,
  FIND_PERFORMERS,
  FIND_STUDIOS,
} from "@/lib/stash/queries";
import type {
  FindScenesQuery,
  FindImagesQuery,
  FindTagsQuery,
  FindPerformersQuery,
  FindStudiosQuery,
} from "@/lib/stash/types";
import { sceneToFeedItem, imageToFeedItem } from "@/lib/stash/feed-item";
import { eq } from "drizzle-orm";

const SYNC_PAGE_SIZE = 100;
const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

const SETTING_LAST_SYNCED = "search_last_synced";
const SETTING_TOTAL_INDEXED = "search_total_indexed";
const SETTING_IN_PROGRESS = "search_sync_in_progress";

// ── Settings helpers ─────────────────────────────────────────────────────────

function getSetting(key: string): string | null {
  return (
    db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
  );
}

function setSetting(key: string, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

// ── Public state queries ──────────────────────────────────────────────────────

export function getSyncState(): {
  lastSyncedAt: Date | null;
  totalIndexed: number;
  inProgress: boolean;
} {
  return {
    lastSyncedAt: (() => {
      const v = getSetting(SETTING_LAST_SYNCED);
      return v ? new Date(parseInt(v, 10)) : null;
    })(),
    totalIndexed: parseInt(getSetting(SETTING_TOTAL_INDEXED) ?? "0", 10),
    inProgress: getSetting(SETTING_IN_PROGRESS) === "1",
  };
}

export function isIndexEmpty(): boolean {
  const media = rawDb
    .prepare("SELECT COUNT(*) as n FROM search_cache")
    .get() as { n: number };
  const entities = rawDb
    .prepare("SELECT COUNT(*) as n FROM search_entities")
    .get() as { n: number };
  return media.n === 0 || entities.n === 0;
}

export function isIndexStale(): boolean {
  const last = getSetting(SETTING_LAST_SYNCED);
  if (!last) return true;
  return Date.now() - parseInt(last, 10) > STALE_MS;
}

// ── Bulk-insert helpers ───────────────────────────────────────────────────────

interface CacheRow {
  stash_id: string;
  media_type: "scene" | "image";
  feed_data: string;
  feed_name: string;
  subreddit: string;
  performers: string;
  tags_text: string;
  studio: string;
  path_text: string;
}

interface EntityRow {
  stash_id: string;
  entity_type: "tag" | "performer" | "studio";
  name: string;
  image_path: string | null;
  count: number;
}

const insertMedia = rawDb.prepare<CacheRow>(`
  INSERT OR REPLACE INTO search_cache
    (stash_id, media_type, feed_data, feed_name, subreddit, performers, tags_text, studio, path_text)
  VALUES
    (@stash_id, @media_type, @feed_data, @feed_name, @subreddit, @performers, @tags_text, @studio, @path_text)
`);

const insertEntity = rawDb.prepare<EntityRow>(`
  INSERT OR REPLACE INTO search_entities
    (stash_id, entity_type, name, image_path, count)
  VALUES
    (@stash_id, @entity_type, @name, @image_path, @count)
`);

const bulkInsertMedia = rawDb.transaction((rows: CacheRow[]) => {
  for (const row of rows) insertMedia.run(row);
});

const bulkInsertEntities = rawDb.transaction((rows: EntityRow[]) => {
  for (const row of rows) insertEntity.run(row);
});

// ── Sync logic ────────────────────────────────────────────────────────────────

async function syncMedia(): Promise<number> {
  let total = 0;
  let page = 1;
  let hasMoreScenes = true;
  let hasMoreImages = true;

  while (hasMoreScenes || hasMoreImages) {
    const [scenesData, imagesData] = await Promise.all([
      hasMoreScenes
        ? stashRequest<FindScenesQuery>(FIND_SCENES, {
            filter: { page, per_page: SYNC_PAGE_SIZE, sort: "id" },
          }).catch(() => ({ findScenes: { count: 0, scenes: [] } }))
        : Promise.resolve({ findScenes: { count: 0, scenes: [] } }),
      hasMoreImages
        ? stashRequest<FindImagesQuery>(FIND_IMAGES, {
            filter: { page, per_page: SYNC_PAGE_SIZE, sort: "id" },
          }).catch(() => ({ findImages: { count: 0, images: [] } }))
        : Promise.resolve({ findImages: { count: 0, images: [] } }),
    ]);

    const sceneRows: CacheRow[] = scenesData.findScenes.scenes.map((s) => {
      const item = sceneToFeedItem(s);
      return {
        stash_id: s.id,
        media_type: "scene",
        feed_data: JSON.stringify(item),
        feed_name: item.title ?? "",
        subreddit: item.subreddit,
        performers: s.performers.map((p) => p.name).join(" "),
        tags_text: s.tags.map((t) => t.name).join(" "),
        studio: s.studio?.name ?? "",
        path_text:
          s.files[0]?.path
            ?.split("/")
            .pop()
            ?.replace(/\.[^.]+$/, "") ?? "",
      };
    });

    const imageRows: CacheRow[] = imagesData.findImages.images.map((img) => {
      const item = imageToFeedItem(img);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileSource = img.files[0] ?? (img as any).visual_files?.[0];
      return {
        stash_id: img.id,
        media_type: "image",
        feed_data: JSON.stringify(item),
        feed_name: item.title ?? "",
        subreddit: item.subreddit,
        performers: img.performers.map((p) => p.name).join(" "),
        tags_text: img.tags.map((t) => t.name).join(" "),
        studio: img.studio?.name ?? "",
        path_text:
          fileSource?.path
            ?.split("/")
            .pop()
            ?.replace(/\.[^.]+$/, "") ?? "",
      };
    });

    const batch = [...sceneRows, ...imageRows];
    if (batch.length > 0) {
      bulkInsertMedia(batch);
      total += batch.length;
    }

    hasMoreScenes = scenesData.findScenes.scenes.length === SYNC_PAGE_SIZE;
    hasMoreImages = imagesData.findImages.images.length === SYNC_PAGE_SIZE;
    page++;
  }

  return total;
}

async function syncEntities(): Promise<void> {
  let page = 1;
  let hasMore = true;

  // Tags
  page = 1;
  hasMore = true;
  while (hasMore) {
    const data = await stashRequest<FindTagsQuery>(FIND_TAGS, {
      filter: { page, per_page: SYNC_PAGE_SIZE, sort: "name" },
    }).catch(() => ({ findTags: { count: 0, tags: [] } }));
    const rows: EntityRow[] = data.findTags.tags.map((t) => ({
      stash_id: t.id,
      entity_type: "tag",
      name: t.name,
      image_path: t.image_path ?? null,
      count: (t.scene_count ?? 0) + (t.image_count ?? 0),
    }));
    if (rows.length > 0) bulkInsertEntities(rows);
    hasMore = data.findTags.tags.length === SYNC_PAGE_SIZE;
    page++;
  }

  // Performers
  page = 1;
  hasMore = true;
  while (hasMore) {
    const data = await stashRequest<FindPerformersQuery>(FIND_PERFORMERS, {
      filter: { page, per_page: SYNC_PAGE_SIZE, sort: "name" },
    }).catch(() => ({ findPerformers: { count: 0, performers: [] } }));
    const rows: EntityRow[] = data.findPerformers.performers.map((p) => ({
      stash_id: p.id,
      entity_type: "performer",
      name: p.name,
      image_path: p.image_path ?? null,
      count: (p.scene_count ?? 0) + (p.image_count ?? 0),
    }));
    if (rows.length > 0) bulkInsertEntities(rows);
    hasMore = data.findPerformers.performers.length === SYNC_PAGE_SIZE;
    page++;
  }

  // Studios
  page = 1;
  hasMore = true;
  while (hasMore) {
    const data = await stashRequest<FindStudiosQuery>(FIND_STUDIOS, {
      filter: { page, per_page: SYNC_PAGE_SIZE, sort: "name" },
    }).catch(() => ({ findStudios: { count: 0, studios: [] } }));
    const rows: EntityRow[] = data.findStudios.studios.map((s) => ({
      stash_id: s.id,
      entity_type: "studio",
      name: s.name,
      image_path: s.image_path ?? null,
      count: s.scene_count ?? 0,
    }));
    if (rows.length > 0) bulkInsertEntities(rows);
    hasMore = data.findStudios.studios.length === SYNC_PAGE_SIZE;
    page++;
  }
}

// ── Run sync ──────────────────────────────────────────────────────────────────

let _syncPromise: Promise<void> | null = null;

export async function runSync(): Promise<void> {
  setSetting(SETTING_IN_PROGRESS, "1");
  try {
    console.log("[search sync] starting full sync…");
    const [total] = await Promise.all([syncMedia(), syncEntities()]);
    rawDb.prepare("INSERT INTO search_fts(search_fts) VALUES('rebuild')").run();
    setSetting(SETTING_LAST_SYNCED, String(Date.now()));
    setSetting(SETTING_TOTAL_INDEXED, String(total));
    console.log(`[search sync] done — ${total} media items indexed`);
  } finally {
    setSetting(SETTING_IN_PROGRESS, "0");
  }
}

export function triggerBackgroundSync(): void {
  if (_syncPromise) return;
  if (getSetting(SETTING_IN_PROGRESS) === "1") return;
  _syncPromise = runSync()
    .catch((err) => console.error("[search sync] failed:", err))
    .finally(() => {
      _syncPromise = null;
    });
}

// ── Scheduler (cron-style, started on app launch) ────────────────────────────

const g = globalThis as typeof globalThis & {
  __substash_sync_scheduled?: boolean;
};

export function scheduleSearchSync(): void {
  if (g.__substash_sync_scheduled) return;
  g.__substash_sync_scheduled = true;

  // Immediate sync on startup when index is missing or stale
  if (isIndexEmpty() || isIndexStale()) {
    triggerBackgroundSync();
  }

  // Periodic re-sync — .unref() so the interval doesn't keep the process alive
  const interval = setInterval(() => {
    if (isIndexStale()) triggerBackgroundSync();
  }, SYNC_INTERVAL_MS);
  if (typeof interval === "object" && "unref" in interval) {
    (interval as NodeJS.Timeout).unref();
  }
}
