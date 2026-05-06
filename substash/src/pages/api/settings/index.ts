import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { invalidateTitleExprCache } from "@/lib/settings/media-title";
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
  return Response.json({
    pinEnabled,
    sessionHours,
    shareEnabled,
    mediaTitleExpr,
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
  return Response.json({ ok: true });
};
