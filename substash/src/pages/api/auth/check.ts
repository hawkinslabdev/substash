import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateSessionToken } from "@/lib/auth/session";

function getSetting(key: string): string | null {
  return (
    db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
  );
}

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ valid: false }, { status: 401 });

  const pinHash = getSetting("pin_hash");
  if (!pinHash) return Response.json({ valid: false }, { status: 401 });

  const sessionHours = parseInt(getSetting("session_hours") ?? "0", 10);
  const shareSecret = import.meta.env.SHARE_SECRET ?? "substash-default-secret";
  const valid = await validateSessionToken(
    token,
    pinHash,
    shareSecret,
    sessionHours,
  );
  return Response.json({ valid }, { status: valid ? 200 : 401 });
};
