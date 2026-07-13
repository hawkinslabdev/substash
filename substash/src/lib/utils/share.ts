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

/** Shared share flow: native share sheet when available, clipboard + toast otherwise. */
export async function shareMedia(
  stashId: string,
  mediaType: "scene" | "image",
  title?: string | null,
): Promise<void> {
  const originalPath = `/${mediaType}s/${stashId}`;
  const url = await getShareUrl(stashId, mediaType, originalPath);
  if (navigator.share) {
    navigator
      .share({
        title: title || (mediaType === "scene" ? "Video" : "Photo"),
        url,
      })
      .catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => {
      window.dispatchEvent(
        new CustomEvent("substash:toast", {
          detail: { message: "Link copied", duration: 2500 },
        }),
      );
    });
  }
}
