import type { APIRoute } from "astro";
import { DEMO_MODE } from "astro:env/server";
import { demoVoteResponse } from "@/lib/demo";
import { stashRequest } from "@/lib/stash/client";
import {
  SCENE_INCREMENT_O,
  SCENE_ADD_PLAY,
  IMAGE_INCREMENT_O,
} from "@/lib/stash/queries";
import type {
  SceneIncrementOMutation,
  SceneAddPlayMutation,
  ImageIncrementOMutation,
} from "@/lib/stash/types";
import { db } from "@/lib/db";
import { likes } from "@/lib/db/schema";

async function recordLike(
  id: string,
  mediaType: "scene" | "image",
  title: string | null,
  thumbnailUrl: string | null,
) {
  try {
    await db
      .insert(likes)
      .values({
        stashId: id,
        mediaType,
        title,
        thumbnailUrl,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: likes.stashId,
        set: { mediaType, title, thumbnailUrl, createdAt: new Date() },
      });
  } catch {
    // Non-fatal; vote still succeeded
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.type) {
    return new Response("Missing id or type", { status: 400 });
  }

  if (DEMO_MODE) return demoVoteResponse(body);

  const { id, type, mediaType, title, thumbnailUrl } = body as {
    id: string;
    type: "o_counter" | "play_count";
    mediaType?: "scene" | "image";
    title?: string;
    thumbnailUrl?: string;
  };

  if (type === "o_counter") {
    if (mediaType === "image") {
      const data = await stashRequest<ImageIncrementOMutation>(
        IMAGE_INCREMENT_O,
        { id },
      );
      recordLike(id, "image", title ?? null, thumbnailUrl ?? null);
      return new Response(JSON.stringify({ o_counter: data.imageIncrementO }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = await stashRequest<SceneIncrementOMutation>(
      SCENE_INCREMENT_O,
      { id },
    );
    recordLike(id, "scene", title ?? null, thumbnailUrl ?? null);
    return new Response(JSON.stringify({ o_counter: data.sceneIncrementO }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (type === "play_count") {
    const data = await stashRequest<SceneAddPlayMutation>(SCENE_ADD_PLAY, {
      id,
    });
    return new Response(JSON.stringify(data.sceneAddPlay), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Invalid type", { status: 400 });
};
