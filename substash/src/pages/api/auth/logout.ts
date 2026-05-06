import type { APIRoute } from "astro";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const POST: APIRoute = ({ request }) => {
  const proto = request.headers.get("x-forwarded-proto") ?? "";
  const url = new URL(request.url);
  const isHttps =
    url.protocol === "https:" || proto.split(",")[0].trim() === "https";

  const base = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

  // Clear both the Secure and non-Secure variants so the cookie is gone
  // regardless of whether the browser or a proxy implicitly added Secure.
  const cookies = isHttps ? [`${base}; Secure`, base] : [base];

  const headers = new Headers({ "Content-Type": "application/json" });
  cookies.forEach((v) => headers.append("Set-Cookie", v));

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
