import { rawDb } from "@/lib/db";
import type { FeedItem } from "@/lib/stash/feed-item";

export type FilterType =
  "all" | "scenes" | "images" | "tags" | "performers" | "studios" | "comments";

export interface SearchResult {
  items: FeedItem[];
  total: number;
  hasMore: boolean;
}

export interface EntityResult {
  stashId: string;
  entityType: "tag" | "performer" | "studio";
  name: string;
  imagePath: string | null;
  count: number;
}

export interface EntitySearchResult {
  entities: EntityResult[];
  total: number;
  hasMore: boolean;
}

export interface CommentHit {
  commentId: string;
  body: string;
  createdAt: number;
  stashId: string;
  mediaType: "scene" | "image";
  mediaItem: FeedItem | null;
}

export interface CommentSearchResult {
  hits: CommentHit[];
  total: number;
  hasMore: boolean;
}

const PER_PAGE = 20;

function sanitizeFtsQuery(q: string): string {
  // Wrap each token in quotes + add prefix wildcard so partial matches work
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(" ");
}

// ── Media search ──────────────────────────────────────────────────────────────

export function searchMedia(
  q: string,
  filter: "all" | "scenes" | "images",
  page: number,
): SearchResult {
  const offset = (page - 1) * PER_PAGE;
  const ftsQ = sanitizeFtsQuery(q);

  const typeFilter =
    filter === "scenes"
      ? "AND sc.media_type = 'scene'"
      : filter === "images"
        ? "AND sc.media_type = 'image'"
        : "";

  const rows = rawDb
    .prepare<[string, number, number], { feed_data: string }>(
      `SELECT sc.feed_data
       FROM search_fts f
       JOIN search_cache sc ON sc.id = f.rowid
       WHERE search_fts MATCH ?
       ${typeFilter}
       ORDER BY rank
       LIMIT ? OFFSET ?`,
    )
    .all(ftsQ, PER_PAGE + 1, offset);

  const countRow = rawDb
    .prepare<[string], { n: number }>(
      `SELECT COUNT(*) as n
       FROM search_fts f
       JOIN search_cache sc ON sc.id = f.rowid
       WHERE search_fts MATCH ?
       ${typeFilter}`,
    )
    .get(ftsQ);

  const hasMore = rows.length > PER_PAGE;
  const items = rows
    .slice(0, PER_PAGE)
    .map((r) => JSON.parse(r.feed_data) as FeedItem);

  return { items, total: countRow?.n ?? 0, hasMore };
}

// ── Subreddit exact-match browse ─────────────────────────────────────────────

// SQLite RANDOM() takes no seed, so a multiplicative hash of rowid stands in.
// 2147483647 is prime, so any non-multiple seed permutes the whole table.
function seededOrder(seed?: number): string {
  if (!seed) return "ORDER BY RANDOM()";
  const s = Math.abs(Math.trunc(seed)) % 2147483647 || 1;
  return `ORDER BY (rowid * ${s}) % 2147483647`;
}

export function searchBySubreddit(
  subreddit: string,
  filter: "all" | "scenes" | "images",
  sort: "date" | "rating" | "random",
  page: number,
  /** Stable shuffle across pages; without it RANDOM() reshuffles per query and page 2 repeats page 1 */
  seed?: number,
): SearchResult {
  const offset = (page - 1) * PER_PAGE;
  const typeFilter =
    filter === "scenes"
      ? "AND media_type = 'scene'"
      : filter === "images"
        ? "AND media_type = 'image'"
        : "";

  const orderBy =
    sort === "rating"
      ? "ORDER BY CAST(json_extract(feed_data, '$.o_counter') AS INTEGER) DESC NULLS LAST, indexed_at DESC"
      : sort === "random"
        ? seededOrder(seed)
        : "ORDER BY json_extract(feed_data, '$.date') DESC NULLS LAST, indexed_at DESC";

  const rows = rawDb
    .prepare<[string, number, number], { feed_data: string }>(
      `SELECT feed_data
       FROM search_cache
       WHERE subreddit = ?
       ${typeFilter}
       ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(subreddit, PER_PAGE + 1, offset);

  const countRow = rawDb
    .prepare<[string], { n: number }>(
      `SELECT COUNT(*) as n
       FROM search_cache
       WHERE subreddit = ?
       ${typeFilter}`,
    )
    .get(subreddit);

  const hasMore = rows.length > PER_PAGE;
  const items = rows
    .slice(0, PER_PAGE)
    .map((r) => JSON.parse(r.feed_data) as FeedItem);

  return { items, total: countRow?.n ?? 0, hasMore };
}

// ── Entity search (tags / performers / studios) ───────────────────────────────
// Uses LIKE rather than FTS5 — entity tables are small (hundreds to low thousands)
// and LIKE works immediately after insert without needing an FTS rebuild.

export function searchEntities(
  q: string,
  entityType: "tag" | "performer" | "studio",
  page: number,
): EntitySearchResult {
  const offset = (page - 1) * PER_PAGE;

  // Build per-token LIKE conditions so "Jennifer Lawrence" matches the full name
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { entities: [], total: 0, hasMore: false };

  const whereClauses = tokens.map(() => "LOWER(name) LIKE ?").join(" AND ");
  const patterns = tokens.map(
    (t) => `%${t.replace(/%/g, "\\%").replace(/_/g, "\\_").toLowerCase()}%`,
  );

  type EntityRow = {
    stash_id: string;
    entity_type: "tag" | "performer" | "studio";
    name: string;
    image_path: string | null;
    count: number;
  };

  const rows = rawDb
    .prepare<unknown[], EntityRow>(
      `SELECT stash_id, entity_type, name, image_path, count
       FROM search_entities
       WHERE entity_type = ? AND ${whereClauses}
       ORDER BY count DESC, name ASC
       LIMIT ? OFFSET ?`,
    )
    .all(entityType, ...patterns, PER_PAGE + 1, offset);

  const countRow = rawDb
    .prepare<unknown[], { n: number }>(
      `SELECT COUNT(*) as n
       FROM search_entities
       WHERE entity_type = ? AND ${whereClauses}`,
    )
    .get(entityType, ...patterns);

  const hasMore = rows.length > PER_PAGE;
  const entities: EntityResult[] = rows.slice(0, PER_PAGE).map((r) => ({
    stashId: r.stash_id,
    entityType: r.entity_type,
    name: r.name,
    imagePath: r.image_path,
    count: r.count,
  }));

  return { entities, total: countRow?.n ?? 0, hasMore };
}

// ── Comment search ────────────────────────────────────────────────────────────

export function searchComments(q: string, page: number): CommentSearchResult {
  const offset = (page - 1) * PER_PAGE;
  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const rows = rawDb
    .prepare<
      [string, number, number],
      {
        id: string;
        body: string;
        created_at: number;
        stash_id: string;
        media_type: "scene" | "image";
        feed_data: string | null;
      }
    >(
      `SELECT c.id, c.body, c.created_at, c.stash_id, c.media_type,
              sc.feed_data
       FROM comments c
       LEFT JOIN search_cache sc
         ON sc.stash_id = c.stash_id AND sc.media_type = c.media_type
       WHERE c.body LIKE ? ESCAPE '\\'
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(pattern, PER_PAGE + 1, offset);

  const countRow = rawDb
    .prepare<[string], { n: number }>(
      `SELECT COUNT(*) as n FROM comments WHERE body LIKE ? ESCAPE '\\'`,
    )
    .get(pattern);

  const hasMore = rows.length > PER_PAGE;
  const hits: CommentHit[] = rows.slice(0, PER_PAGE).map((r) => ({
    commentId: r.id,
    body: r.body,
    createdAt: r.created_at,
    stashId: r.stash_id,
    mediaType: r.media_type,
    mediaItem: r.feed_data ? (JSON.parse(r.feed_data) as FeedItem) : null,
  }));

  return { hits, total: countRow?.n ?? 0, hasMore };
}
