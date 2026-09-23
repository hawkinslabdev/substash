import node from "astro/logger/node";

// Astro's node logger, minus the per-request info lines for proxied media
const MEDIA_REQUEST = /\/api\/stash\/(image|stream)\b/;

export default function logger(config) {
  const destination = node(config);
  return {
    write(event) {
      if (event.level === "info" && MEDIA_REQUEST.test(event.message)) return;
      destination.write(event);
    },
  };
}
