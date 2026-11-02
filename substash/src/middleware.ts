import { defineMiddleware, sequence } from "astro:middleware";
import { db } from "@/lib/db";
import { settings, shareLinks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { hmacSha256hex, timingSafeEqual, sha256hex } from "@/lib/utils/crypto";
import { scheduleSearchSync } from "@/lib/search/sync";

// Start cron-based search index sync (runs on app launch + every 6 hours).
// Guarded inside scheduleSearchSync with a globalThis flag — safe under HMR.
scheduleSearchSync();

// Static/non-data paths that are always public
const PAGE_BYPASS = [
  "/auth",
  "/share/",
  "/_astro/",
  "/manifest",
  "/sw.js",
  "/favicon",
];

// Stream stays gated: same-origin <video> range requests carry the SameSite=Lax cookie
const API_BYPASS = ["/api/auth/"];

function unauth401() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function getSetting(key: string): string | null {
  return (
    db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
  );
}

// A share key unlocks only its own page and, for scenes, that scene's stream
async function isValidShareKey(
  shareKey: string,
  pathname: string,
): Promise<boolean> {
  if (getSetting("share_enabled") !== "true") return false;
  const row = db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, shareKey))
    .get();
  if (!row) return false;
  const allowed =
    pathname === row.originalPath ||
    (row.mediaType === "scene" &&
      pathname === `/api/stash/stream/${row.stashId}`);
  if (!allowed) return false;
  const shareSecret = import.meta.env.SHARE_SECRET ?? "substash-default-secret";
  const expected = await hmacSha256hex(
    `${row.stashId}${row.mediaType}`,
    shareSecret,
  );
  return timingSafeEqual(expected, row.hmac);
}

// Cached HTML requests deleted asset hashes, and replays authed pages on BACK after logout
const noStoreHtml = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (res.headers.get("content-type")?.includes("text/html")) {
    res.headers.set("Cache-Control", "no-store, must-revalidate");
  }
  return res;
});

const authGate = defineMiddleware(
  async ({ request, cookies, redirect }, next) => {
    // undefined → enforce auth without Secure flag (same as false).
    // false → auth via cookie without Secure flag (reverse-proxy HTTPS).
    // true  → auth via cookie with Secure flag (direct HTTPS).

    const pinEnabled = getSetting("pin_enabled") === "true";
    if (!pinEnabled) return next();

    const { pathname, searchParams } = new URL(request.url);

    if (API_BYPASS.some((p) => pathname.startsWith(p))) return next();
    if (PAGE_BYPASS.some((p) => pathname.startsWith(p))) return next();

    const shareKey = searchParams.get("shareKey");
    if (shareKey && (await isValidShareKey(shareKey, pathname))) return next();

    // Validate session cookie
    const token = cookies.get(SESSION_COOKIE)?.value;
    const pinHash = getSetting("pin_hash");
    const shareSecret =
      import.meta.env.SHARE_SECRET ?? "substash-default-secret";
    const pinOverride = import.meta.env.PIN_OVERRIDE;
    const effectiveHash =
      pinHash ?? (pinOverride ? await sha256hex(pinOverride) : null);

    if (!effectiveHash) return next();

    const sessionHours = parseInt(getSetting("session_hours") ?? "0", 10);

    if (
      !token ||
      !(await validateSessionToken(
        token,
        effectiveHash,
        shareSecret,
        sessionHours,
      ))
    ) {
      if (pathname.startsWith("/api/")) return unauth401();
      return redirect(`/auth?from=${encodeURIComponent(pathname)}`);
    }

    return next();
  },
);

export const onRequest = sequence(noStoreHtml, authGate);
