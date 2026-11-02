import { rawDb } from "@/lib/db";
import type { FeedItem } from "@/lib/stash/feed-item";

// Stash returns a generated placeholder URL (default=true) for tags without an image
export const hasOwnImage = (path: string | null | undefined) =>
  !!path && !path.includes("default=true");

const coverOf = (item: Pick<FeedItem, "paths">) =>
  ("screenshot" in item.paths ? item.paths.screenshot : null) ??
  ("thumbnail" in item.paths ? item.paths.thumbnail : null) ??
  null;

/** Newest media per tag, from the local search index (one query, no Stash calls). */
export function getTagCovers(tagIds: string[]): Map<string, string> {
  const covers = new Map<string, string>();
  if (tagIds.length === 0) return covers;
  const rows = rawDb
    .prepare(
      `SELECT t.value ->> '$.id' AS tag_id,
              coalesce(c.feed_data ->> '$.paths.screenshot', c.feed_data ->> '$.paths.thumbnail') AS cover
         FROM search_cache c, json_each(c.feed_data, '$.tags') t
        WHERE t.value ->> '$.id' IN (SELECT value FROM json_each(?))
          AND cover IS NOT NULL
        ORDER BY c.feed_data ->> '$.date' DESC, c.id DESC`,
    )
    .all(JSON.stringify(tagIds)) as { tag_id: string; cover: string }[];
  for (const r of rows)
    if (!covers.has(r.tag_id)) covers.set(r.tag_id, r.cover);
  return covers;
}

/** Same as getTagCovers, for demo mode where nothing is indexed. */
export function getDemoTagCovers(items: FeedItem[]): Map<string, string> {
  const covers = new Map<string, string>();
  const newest = [...items].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );
  for (const item of newest) {
    const cover = coverOf(item);
    if (!cover) continue;
    for (const t of item.tags) if (!covers.has(t.id)) covers.set(t.id, cover);
  }
  return covers;
}
