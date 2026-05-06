import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { invalidateTitleExprCache } from "@/lib/settings/media-title";
import { invalidateFeedSettingsCache } from "@/lib/settings/feed";
import { DEFAULT_TITLE_EXPR } from "@/lib/utils/media-title";

function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

function upsert(key: string, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export const GET: APIRoute = () => {
  const pinEnabled = getSetting("pin_enabled") === "true";
  const sessionHours = parseInt(getSetting("session_hours") ?? "0", 10);
  const shareEnabled = getSetting("share_enabled") === "true";
  const mediaTitleExpr = getSetting("media_title_expr") ?? DEFAULT_TITLE_EXPR;
  const feedFallbackName = getSetting("feed_fallback_name") ?? "discover";
  const feedShowPrefix = (getSetting("feed_show_prefix") ?? "true") !== "false";
  const pageNameTags = getSetting("page_name_tags") ?? "Tags";
  const pageNamePerformers = getSetting("page_name_performers") ?? "Creators";
  const pageNameStudios = getSetting("page_name_studios") ?? "Studios";
  return Response.json({
    pinEnabled,
    sessionHours,
    shareEnabled,
    mediaTitleExpr,
    feedFallbackName,
    feedShowPrefix,
    pageNameTags,
    pageNamePerformers,
    pageNameStudios,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (typeof body.shareEnabled === "boolean") {
    upsert("share_enabled", body.shareEnabled ? "true" : "false");
  }
  if (typeof body.sessionHours === "number" && body.sessionHours >= 0) {
    upsert("session_hours", String(Math.floor(body.sessionHours)));
  }
  if (typeof body.mediaTitleExpr === "string" && body.mediaTitleExpr.trim()) {
    upsert("media_title_expr", body.mediaTitleExpr.trim());
    invalidateTitleExprCache();
  }
  if (typeof body.feedFallbackName === "string") {
    upsert("feed_fallback_name", body.feedFallbackName.trim() || "discover");
    invalidateFeedSettingsCache();
  }
  if (typeof body.feedShowPrefix === "boolean") {
    upsert("feed_show_prefix", body.feedShowPrefix ? "true" : "false");
    invalidateFeedSettingsCache();
  }
  if (typeof body.pageNameTags === "string") {
    upsert("page_name_tags", body.pageNameTags.trim() || "Tags");
  }
  if (typeof body.pageNamePerformers === "string") {
    upsert(
      "page_name_performers",
      body.pageNamePerformers.trim() || "Creators",
    );
  }
  if (typeof body.pageNameStudios === "string") {
    upsert("page_name_studios", body.pageNameStudios.trim() || "Studios");
  }
  return Response.json({ ok: true });
};
