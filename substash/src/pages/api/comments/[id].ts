import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response("Missing id", { status: 400 });

  const deleted = await db
    .delete(comments)
    .where(eq(comments.id, id))
    .returning();

  if (!deleted.length) return new Response("Not found", { status: 404 });

  return new Response(null, { status: 204 });
};
