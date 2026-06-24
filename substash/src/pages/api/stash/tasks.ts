import type { APIRoute } from "astro";
import { DEMO_MODE } from "astro:env/server";
import { stashRequest } from "@/lib/stash/client";
import {
  METADATA_SCAN,
  METADATA_AUTO_TAG,
  METADATA_GENERATE,
} from "@/lib/stash/queries";

const TASKS = {
  scan: METADATA_SCAN,
  autotag: METADATA_AUTO_TAG,
  generate: METADATA_GENERATE,
} as const;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const task = body?.task as keyof typeof TASKS | undefined;

  if (!task || !(task in TASKS)) {
    return new Response("Invalid task", { status: 400 });
  }

  if (DEMO_MODE) {
    return new Response(JSON.stringify({ ok: true, jobId: "demo" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await stashRequest<Record<string, string>>(TASKS[task]);
  const jobId = Object.values(data)[0];
  return new Response(JSON.stringify({ ok: true, jobId }), {
    headers: { "Content-Type": "application/json" },
  });
};
