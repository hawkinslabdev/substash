let shareEnabledCache: boolean | null = null;

async function isShareEnabled(): Promise<boolean> {
  if (shareEnabledCache !== null) return shareEnabledCache;
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    shareEnabledCache = !!data.shareEnabled;
  } catch {
    shareEnabledCache = false;
  }
  return shareEnabledCache;
}

export async function getShareUrl(
  stashId: string,
  mediaType: "scene" | "image",
  originalPath: string,
): Promise<string> {
  const enabled = await isShareEnabled();
  if (!enabled) return `${location.origin}${originalPath}`;

  try {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stashId, mediaType, originalPath }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return `${location.origin}${data.shareUrl}`;
  } catch {
    return `${location.origin}${originalPath}`;
  }
}

export function resetShareCache() {
  shareEnabledCache = null;
}
