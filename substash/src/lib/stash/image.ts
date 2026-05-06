/** Convert any Stash image URL to the server-side proxy route. */
export function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/stash/image?url=${encodeURIComponent(url)}`;
}
