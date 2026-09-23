import type { APIRoute } from "astro";
import { getAppName } from "@/lib/settings/app-name";

export const GET: APIRoute = () => {
  const name = getAppName();
  return Response.json(
    {
      name,
      short_name: name,
      description: "Your personal media feed",
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0d0d0d",
      theme_color: "#0d0d0d",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
};
