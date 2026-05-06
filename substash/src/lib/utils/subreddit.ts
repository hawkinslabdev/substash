import {
  evalTitleExpr,
  formatOriginDisplay,
  parseRichTitle,
  type MediaTitleContext,
} from "./media-title";

export { formatOriginDisplay };
import { getTitleExpr } from "@/lib/settings/media-title";
import { getFeedSettings } from "@/lib/settings/feed";

export interface SubredditInfo {
  subreddit: string;
  displayName: string;
  cleanTitle: string;
  isExtracted: boolean;
  performer: string | null;
  origin: string | null;
  credit: string | null;
  day: string | null;
}

export interface ResolveTitleOpts {
  expr?: string;
  studio?: string | null;
  performers?: string[];
  tags?: string[];
  date?: string | null;
  rating?: number | null;
}

function toDisplayName(sub: string, showPrefix: boolean): string {
  if (!showPrefix) return sub.startsWith("u_") ? sub.slice(2) : sub;
  return sub.startsWith("u_") ? `u/${sub.slice(2)}` : `r/${sub}`;
}

/**
 * Full pipeline: Stash title + file path/basename + Stash metadata → SubredditInfo.
 *
 * All Stash API fields (studio, performers, tags, date, rating) and all parsed title
 * components (subreddit, postTitle, author, dateStr, hash, clean) are exposed to the
 * user-configured title script (Settings → Display → Title script).
 *
 * Pass `opts.expr` to override the stored setting (used by the preview endpoint).
 */
export function resolveTitle(
  stashTitle: string | null | undefined,
  filePath?: string | null,
  basename?: string | null,
  opts?: ResolveTitleOpts,
): SubredditInfo {
  const fileBase = basename ?? filePath?.split("/").pop() ?? null;
  const ext = fileBase?.match(/\.([^.]+)$/)?.[1] ?? null;
  const filenameNoExt = fileBase ? fileBase.replace(/\.[^/.]+$/, "") : null;

  const rawBase = stashTitle?.trim() || filenameNoExt || null;
  const parsed = rawBase ? parseRichTitle(rawBase) : null;

  const ctx: MediaTitleContext = {
    // Stash API fields
    title: stashTitle?.trim() || null,
    date: opts?.date ?? null,
    rating: opts?.rating ?? null,
    studio: opts?.studio ?? null,
    performers: opts?.performers ?? [],
    tags: opts?.tags ?? [],
    // File fields
    filename: filenameNoExt,
    basename: fileBase,
    ext,
    // Parsed from title
    subreddit: parsed?.subreddit ?? null,
    postTitle: parsed?.postTitle ?? null,
    author: parsed?.author ?? null,
    dateStr: parsed?.dateStr ?? null,
    hash: parsed?.hash ?? null,
    clean: parsed?.clean ?? null,
  };

  const result = evalTitleExpr(ctx, opts?.expr ?? getTitleExpr());
  const { fallbackName, showPrefix } = getFeedSettings();
  const fallbackDisplay = showPrefix ? `r/${fallbackName}` : fallbackName;

  return {
    subreddit: parsed?.subreddit ?? fallbackName,
    displayName: parsed?.subreddit
      ? toDisplayName(parsed.subreddit, showPrefix)
      : fallbackDisplay,
    cleanTitle: result.title ?? "",
    isExtracted: parsed?.subreddit != null,
    performer: result.performer,
    origin: result.origin,
    credit: result.credit,
    day: result.day,
  };
}

/** Kept for API compatibility; prefer `resolveTitle` for new code. */
export function extractSubreddit(
  rawTitle: string | null | undefined,
): SubredditInfo {
  const { fallbackName, showPrefix } = getFeedSettings();
  const fallbackDisplay = showPrefix ? `r/${fallbackName}` : fallbackName;
  if (!rawTitle) {
    return {
      subreddit: fallbackName,
      displayName: fallbackDisplay,
      cleanTitle: "",
      isExtracted: false,
      performer: null,
      origin: null,
      credit: null,
      day: null,
    };
  }
  const p = parseRichTitle(rawTitle);
  return {
    subreddit: p.subreddit ?? fallbackName,
    displayName: p.subreddit
      ? toDisplayName(p.subreddit, showPrefix)
      : fallbackDisplay,
    cleanTitle: p.clean ?? "",
    isExtracted: p.subreddit != null,
    performer: null,
    origin: null,
    credit: null,
    day: null,
  };
}
