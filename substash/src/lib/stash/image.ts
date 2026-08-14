/** Convert any Stash image URL to the server-side proxy route. */
export function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  // Already proxied: wrapping again yields a relative `url` param → HTTP 400
  if (url.startsWith("/api/stash/image?")) return url;
  return `/api/stash/image?url=${encodeURIComponent(url)}`;
}
