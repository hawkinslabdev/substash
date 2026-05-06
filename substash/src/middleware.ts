import { defineMiddleware } from "astro:middleware";
import { db } from "@/lib/db";
import { settings, shareLinks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { hmacSha256hex, timingSafeEqual, sha256hex } from "@/lib/utils/crypto";

// Static/non-data paths that are always public
const PAGE_BYPASS = [
  "/auth",
  "/share/",
  "/_astro/",
  "/manifest",
  "/sw.js",
  "/favicon",
];

// Media streaming — browsers send range requests that don't reliably carry cookies;
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

export const onRequest = defineMiddleware(
  async ({ request, cookies, redirect }, next) => {
    // Only enforce when PUBLIC_AUTH_COOKIE_SECURE is explicitly set.
    // undefined = no auth configured (pure dev, no PIN).
    // false = auth via cookie without Secure flag (reverse-proxy HTTPS).
    // true  = auth via cookie with Secure flag (direct HTTPS).
    if (import.meta.env.PUBLIC_AUTH_COOKIE_SECURE === undefined) return next();

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

    if (
      !token ||
      !(await validateSessionToken(token, effectiveHash, shareSecret))
    ) {
      if (pathname.startsWith("/api/")) return unauth401();
      return redirect(`/auth?from=${encodeURIComponent(pathname)}`);
    }

    return next();
  },
);
