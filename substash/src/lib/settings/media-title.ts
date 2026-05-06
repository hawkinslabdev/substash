import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_TITLE_EXPR } from "@/lib/utils/media-title";

// 3-second TTL — cheap to refresh, avoids per-item DB reads in bulk processing
let _cache: { expr: string; ts: number } | null = null;

export function getTitleExpr(): string {
  const now = Date.now();
  if (!_cache || now - _cache.ts > 3000) {
    const row = db
      .select()
      .from(settings)
      .where(eq(settings.key, "media_title_expr"))
      .get();
    _cache = { expr: row?.value ?? DEFAULT_TITLE_EXPR, ts: now };
  }
  return _cache.expr;
}

export function invalidateTitleExprCache(): void {
  _cache = null;
}
