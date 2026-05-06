import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sha256hex } from "@/lib/utils/crypto";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const PIN_RE = /^[a-zA-Z0-9]{6}$/;

function getSetting(key: string): string | null {
  return (
    db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
  );
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!PIN_RE.test(body.pin ?? "")) {
    return Response.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  const pinOverride = import.meta.env.PIN_OVERRIDE;
  const usingOverride = pinOverride && body.pin === pinOverride;

  const pinHash = getSetting("pin_hash");
  if (!pinHash && !usingOverride) {
    return Response.json({ error: "No PIN configured" }, { status: 401 });
  }

  if (!usingOverride) {
    const inputHash = await sha256hex(body.pin);
    if (inputHash !== pinHash) {
      await new Promise((r) => setTimeout(r, 300));
      return Response.json({ error: "Invalid PIN" }, { status: 401 });
    }
  }

  const effectiveHash = pinHash ?? (await sha256hex(pinOverride!));
  const sessionHours = parseInt(getSetting("session_hours") ?? "0", 10);
  const shareSecret = import.meta.env.SHARE_SECRET ?? "substash-default-secret";
  const { token, expiresAt } = await createSessionToken(
    effectiveHash,
    shareSecret,
    sessionHours,
  );

  const secure = import.meta.env.PUBLIC_AUTH_COOKIE_SECURE === "true";
  const maxAge = expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : 0;
  const cookieParts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
    ...(maxAge > 0 ? [`Max-Age=${maxAge}`] : []),
  ];

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieParts.join("; "),
    },
  });
};
