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

// Media streaming; browsers send range requests that don't reliably carry cookies;
// stream content is only meaningful if you already know the internal scene ID.
const API_BYPASS = ["/api/auth/", "/api/stash/stream/"];

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

async function isValidShareKey(shareKey: string): Promise<boolean> {
  const row = db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, shareKey))
    .get();
  if (!row) return false;
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

    // Valid share key grants access to the target page
    const shareKey = searchParams.get("shareKey");
    if (shareKey && (await isValidShareKey(shareKey))) return next();

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
