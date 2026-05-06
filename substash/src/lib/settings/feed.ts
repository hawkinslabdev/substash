import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export interface FeedSettings {
  fallbackName: string;
  showPrefix: boolean;
}

let _cache: { value: FeedSettings; ts: number } | null = null;

export function getFeedSettings(): FeedSettings {
  const now = Date.now();
  if (!_cache || now - _cache.ts > 3000) {
    const rows = db.select().from(settings).all();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    _cache = {
      value: {
        fallbackName: map["feed_fallback_name"] ?? "discover",
        showPrefix: (map["feed_show_prefix"] ?? "true") !== "false",
      },
      ts: now,
    };
  }
  return _cache.value;
}

export function invalidateFeedSettingsCache(): void {
  _cache = null;
}
