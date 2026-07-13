import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { count, inArray } from "drizzle-orm";

/** Map of stashId → comment count for the given ids. */
export function getCommentCounts(ids: string[]): Map<string, number> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ stashId: comments.stashId, n: count() })
    .from(comments)
    .where(inArray(comments.stashId, ids))
    .groupBy(comments.stashId)
    .all();
  return new Map(rows.map((r) => [r.stashId, r.n]));
}

/** Fill commentCount on feed items in place. Server-side only. */
export function attachCommentCounts<
  T extends { id: string; commentCount: number },
>(items: T[]): T[] {
  const map = getCommentCounts(items.map((i) => i.id));
  for (const item of items) {
    item.commentCount = map.get(item.id) ?? 0;
  }
  return items;
}
