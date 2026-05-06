import type { APIRoute } from "astro";
import { validateTitleExpr } from "@/lib/utils/media-title";
import { resolveTitle } from "@/lib/utils/subreddit";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const {
    expr,
    title = null,
    basename = null,
    studio = null,
    performers = [],
    tags = [],
    date = null,
    rating = null,
  } = body;

  if (typeof expr !== "string" || !expr.trim()) {
    return Response.json(
      { ok: false, error: "Expression is required" },
      { status: 400 },
    );
  }

  const validation = validateTitleExpr(expr);
  if (!validation.ok) {
    return Response.json({ ok: false, error: validation.error });
  }

  const info = resolveTitle(title, null, basename, {
    expr,
    studio,
    performers: Array.isArray(performers) ? performers : [],
    tags: Array.isArray(tags) ? tags : [],
    date,
    rating: typeof rating === "number" ? rating : null,
  });

  return Response.json({
    ok: true,
    result: {
      title: info.cleanTitle || null,
      performer: info.performer,
      origin: info.origin,
      credit: info.credit,
      day: info.day,
    },
  });
};
