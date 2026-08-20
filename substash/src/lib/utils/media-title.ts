export interface MediaTitleContext {
  title: string | null; // raw title stored in Stash
  date: string | null; // scene/image date from Stash (YYYY-MM-DD)
  rating: number | null; // rating 0–100
  studio: string | null; // studio name
  performers: string[]; // performer names
  tags: string[]; // tag names
  filename: string | null; // basename without extension
  basename: string | null; // full basename with extension
  ext: string | null; // file extension (no dot)
  subreddit: string | null; // e.g. "memes", null if no "sub - rest" pattern
  postTitle: string | null; // portion after "subreddit - " prefix, unstripped
  author: string | null; // from "(by Author)" pattern
  dateStr: string | null; // timestamp embedded in title, e.g. "2026-04-24T17:49:48"
  hash: string | null; // from "#hash" pattern (without #)
  clean: string | null; // postTitle with author/dateStr/hash/brackets stripped
}

export interface MetadataExprResult {
  title: string | null;
  performer: string | null;
  origin: string | null;
  credit: string | null;
  day: string | null;
}

export interface ParsedTitleParts {
  subreddit: string | null;
  postTitle: string | null;
  author: string | null;
  dateStr: string | null;
  hash: string | null;
  clean: string | null;
}

// "subreddit_name - rest of title"
const SUBREDDIT_PATTERN = /^([a-zA-Z0-9_]{2,})\s+-\s+(.+)$/s;
// Matches both compact (T142508) and ISO-with-colons (T17:49:48) formats
const TIMESTAMP_RE = /\s+(\d{4}-\d{2}-\d{2}T(?:\d{2}:\d{2}:\d{2}|\d{6,}))/;
const HASH_RE = /\s+#(\S+)/;
const BY_AUTHOR_RE = /\s*\(by\s+([^)]+)\)/i;
const BRACKET_RE = /\s*\[[a-zA-Z0-9_-]+\]/g;

const PARAM_NAMES = [
  // Stash API
  "title",
  "date",
  "rating",
  "studio",
  "performers",
  "tags",
  // File
  "filename",
  "basename",
  "ext",
  // Parsed from title
  "subreddit",
  "postTitle",
  "author",
  "dateStr",
  "hash",
  "clean",
] as const;

/**
 * Parse a raw title string into its structured components.
 * Used server-side in `resolveTitle` and client-side in the settings preview.
 */
export function parseRichTitle(rawTitle: string): ParsedTitleParts {
  let subreddit: string | null = null;
  let postTitle = rawTitle.trim();

  const m = postTitle.match(SUBREDDIT_PATTERN);
  if (m) {
    subreddit = m[1];
    postTitle = m[2].trim();
  }

  const author = postTitle.match(BY_AUTHOR_RE)?.[1]?.trim() ?? null;
  const dateStr = postTitle.match(TIMESTAMP_RE)?.[1] ?? null;
  const hash = postTitle.match(HASH_RE)?.[1] ?? null;

  const clean =
    postTitle
      .replace(/\s*\(by\s+[^)]+\)/gi, "")
      .replace(/\s+\d{4}-\d{2}-\d{2}T(?:\d{2}:\d{2}:\d{2}|\d{6,})/g, "")
      .replace(/\s+#\S+/g, "")
      .replace(BRACKET_RE, "")
      .trim() || null;

  return {
    subreddit,
    postTitle: postTitle || null,
    author,
    dateStr,
    hash,
    clean,
  };
}

/**
 * Default script; preserves original behavior (clean title or filename).
 * All available variables are defined so users can include them by editing the return.
 */
export const DEFAULT_TITLE_EXPR = `const base      = clean || filename;
const performer = performers[0] || null;
const origin    = subreddit || null;
const credit    = author || null;
const day       = date || (dateStr ? dateStr.split("T")[0] : null);
return { title: base, performer, origin, credit, day };`;

/**
 * Build a callable function from a user-supplied script.
 *
 * Two modes (tried in order):
 *   1. Expression ; `return (${code})`; single-line shorthands like `clean || filename`
 *   2. Script body; `${code}` raw     ; multi-statement; must include `return`
 *
 * Returns null when the code cannot be compiled in either mode.
 */
function buildFn(code: string): ((...args: unknown[]) => unknown) | null {
  try {
    // eslint-disable-next-line no-new-func
    return new Function(...PARAM_NAMES, `return (${code})`) as (
      ...args: unknown[]
    ) => unknown;
  } catch (e) {
    if (!(e instanceof SyntaxError)) return null;
  }
  try {
    // eslint-disable-next-line no-new-func
    return new Function(...PARAM_NAMES, code) as (
      ...args: unknown[]
    ) => unknown;
  } catch {
    return null;
  }
}

function ctxArgs(ctx: MediaTitleContext): unknown[] {
  return [
    ctx.title,
    ctx.date,
    ctx.rating,
    ctx.studio,
    ctx.performers,
    ctx.tags,
    ctx.filename,
    ctx.basename,
    ctx.ext,
    ctx.subreddit,
    ctx.postTitle,
    ctx.author,
    ctx.dateStr,
    ctx.hash,
    ctx.clean,
  ];
}

function normalizeExprResult(raw: unknown): MetadataExprResult {
  const str = (v: unknown): string | null =>
    typeof v === "string" ? v.trim() || null : null;
  if (typeof raw === "string") {
    return {
      title: raw.trim() || null,
      performer: null,
      origin: null,
      credit: null,
      day: null,
    };
  }
  if (raw !== null && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      title: str(r.title),
      performer: str(r.performer),
      origin: str(r.origin),
      credit: str(r.credit),
      day: str(r.day),
    };
  }
  return {
    title: null,
    performer: null,
    origin: null,
    credit: null,
    day: null,
  };
}

export function evalTitleExpr(
  ctx: MediaTitleContext,
  expr?: string,
): MetadataExprResult {
  const code = (expr ?? DEFAULT_TITLE_EXPR).trim();
  const fn = buildFn(code);
  const fallback: MetadataExprResult = {
    title: ctx.clean ?? ctx.title ?? ctx.filename,
    performer: null,
    origin: null,
    credit: null,
    day: null,
  };
  if (!fn) return fallback;
  try {
    return normalizeExprResult(fn(...ctxArgs(ctx)));
  } catch {
    return fallback;
  }
}

export function formatOriginDisplay(
  origin: string | null,
  fallback: string,
  showPrefix = true,
): string {
  if (!origin) return fallback;
  if (origin.includes("/")) return origin;
  if (!showPrefix) return origin.startsWith("u_") ? origin.slice(2) : origin;
  return origin.startsWith("u_") ? `u/${origin.slice(2)}` : `r/${origin}`;
}

export type ValidationResult =
  { ok: true; mode: "expression" | "script" } | { ok: false; error: string };

/** Syntax-check a script without running it. Reports which mode it will use. */
export function validateTitleExpr(expr: string): ValidationResult {
  const code = expr.trim();
  if (!code) return { ok: false, error: "Script cannot be empty." };

  try {
    // eslint-disable-next-line no-new-func
    new Function(...PARAM_NAMES, `return (${code})`);
    return { ok: true, mode: "expression" };
  } catch (e1) {
    if (!(e1 instanceof SyntaxError)) {
      return {
        ok: false,
        error: e1 instanceof Error ? e1.message : String(e1),
      };
    }
  }

  try {
    // eslint-disable-next-line no-new-func
    new Function(...PARAM_NAMES, code);
    return { ok: true, mode: "script" };
  } catch (e2) {
    return {
      ok: false,
      error: e2 instanceof SyntaxError ? e2.message : String(e2),
    };
  }
}
