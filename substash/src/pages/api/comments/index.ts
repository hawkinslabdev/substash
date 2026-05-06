import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "@/lib/utils/ulid";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const stashId = url.searchParams.get("stashId");
  if (!stashId) return new Response("Missing stashId", { status: 400 });

  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.stashId, stashId))
    .orderBy(comments.createdAt);

  return new Response(JSON.stringify(rows), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (
    !body?.stashId ||
    !body?.body ||
    !["scene", "image"].includes(body?.mediaType)
  ) {
    return new Response("Missing stashId, body, or mediaType", { status: 400 });
  }

  const row = {
    id: ulid(),
    stashId: body.stashId as string,
    mediaType: body.mediaType as "scene" | "image",
    parentId: (body.parentId as string) ?? null,
    body: body.body as string,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    createdAt: new Date(),
  };

  await db.insert(comments).values(row);

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
