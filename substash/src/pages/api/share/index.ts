import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { settings, shareLinks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hmacSha256hex, generateToken } from "@/lib/utils/crypto";

const PATH_RE = /^\/(scenes|images)\/[^/]+$/;

function getSetting(key: string): string | null {
  return (
    db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
  );
}

export const POST: APIRoute = async ({ request }) => {
  if (getSetting("share_enabled") !== "true") {
    return Response.json(
      { error: "Private sharing is disabled" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { stashId, mediaType, originalPath } = body;

  if (
    !stashId ||
    !["scene", "image"].includes(mediaType) ||
    !PATH_RE.test(originalPath ?? "")
  ) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const shareSecret = import.meta.env.SHARE_SECRET ?? "substash-default-secret";
  const hmac = await hmacSha256hex(`${stashId}${mediaType}`, shareSecret);

  let token = generateToken(10);
  for (let i = 0; i < 3; i++) {
    const existing = db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token))
      .get();
    if (!existing) break;
    token = generateToken(10);
  }

  db.insert(shareLinks)
    .values({
      token,
      originalPath,
      stashId,
      mediaType,
      hmac,
      createdAt: new Date(),
    })
    .run();

  return Response.json({ shareUrl: `/share/${token}` });
};
