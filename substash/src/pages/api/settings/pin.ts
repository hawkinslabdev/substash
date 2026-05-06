import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sha256hex } from "@/lib/utils/crypto";

const PIN_RE = /^[a-zA-Z0-9]{6}$/;

function upsert(key: string, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!PIN_RE.test(body.pin ?? "")) {
    return Response.json(
      { error: "PIN must be exactly 6 alphanumeric characters" },
      { status: 400 },
    );
  }
  const hash = await sha256hex(body.pin);
  upsert("pin_hash", hash);
  upsert("pin_enabled", "true");
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = () => {
  db.delete(settings).where(eq(settings.key, "pin_hash")).run();
  db.insert(settings)
    .values({ key: "pin_enabled", value: "false" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "false" } })
    .run();
  return Response.json({ ok: true });
};
