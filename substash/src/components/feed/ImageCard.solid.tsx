import { Show, onMount, onCleanup } from "solid-js";
import { navigate } from "astro:transitions/client";
import VoteButton from "@/components/post/VoteButton.solid";
import { proxyImage } from "@/lib/stash/image";
import { timeAgo } from "@/lib/utils/markdown";
import { getShareUrl } from "@/lib/utils/share";
import type { ImageFeedItem } from "@/lib/stash/feed-item";

interface Props {
  image: ImageFeedItem;
  class?: string;
}

export default function ImageCard(props: Props) {
  const image = () => props.image;
  const isVideo = () => !!image().paths.preview;
  let videoEl: HTMLVideoElement | undefined;

  onMount(() => {
    if (!videoEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.intersectionRatio >= 0.5) {
          const p = videoEl!.play();
          if (p !== undefined) p.catch(() => {});
        } else {
          videoEl!.pause();
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(videoEl);
    onCleanup(() => observer.disconnect());
  });

  const displayUrl = () => {
    const raw = image().paths.preview || image().paths.thumbnail;
    return raw ? proxyImage(raw) : null;
  };

  const thumbUrl = () =>
    image().paths.thumbnail ? proxyImage(image().paths.thumbnail) : null;

  async function handleShare() {
    const originalPath = `/images/${image().id}`;
    const url = await getShareUrl(image().id, "image", originalPath);
    if (navigator.share) {
      navigator.share({ title: image().title || "Photo", url }).catch(() => {});
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

  return (
    <article
      class={`feed-item flex flex-col bg-[var(--color-surface)] border-b border-[var(--color-border)] ${props.class ?? ""}`}
      data-stash-id={image().id}
      data-stash-type="image"
    >
      {/* Card header: origin · performer · date */}
      <div class="px-4 pt-3 pb-1.5 flex items-center gap-2">
        <a
          href={
            image().subredditExtracted
              ? image().subreddit.startsWith("u_")
                ? `/search?user=${encodeURIComponent(image().subreddit.slice(2))}`
                : `/search?r=${encodeURIComponent(image().subreddit)}`
              : "/discover"
          }
          onClick={(e) => e.stopPropagation()}
          class="text-xs font-bold text-[var(--color-accent)] tracking-wide hover:opacity-75 transition-opacity"
        >
          {image().originDisplay}
        </a>
        <Show when={image().metaPerformer}>
          <span
            class="text-xs font-bold text-[var(--color-text-muted)]"
            aria-hidden="true"
          >
            ·
          </span>
          <span class="text-xs font-semibold text-[var(--color-text)]">
            {image().metaPerformer}
          </span>
        </Show>
        <Show when={image().date || image().metaDay}>
          <span
            class="text-xs font-bold text-[var(--color-text-muted)]"
            aria-hidden="true"
          >
            ·
          </span>
          <time
            class="text-xs text-[var(--color-text-muted)]"
            datetime={image().date ?? undefined}
          >
            {image().metaDay ?? timeAgo(new Date(image().date! + "T00:00:00"))}
          </time>
        </Show>
      </div>

      {/* Title — above the media */}
      <a
        href={`/images/${image().id}`}
        class="block px-4 pb-2 min-h-0 min-w-0 hover:text-[var(--color-accent)] transition-colors"
        data-astro-prefetch="viewport"
      >
        <h2 class="text-[15px] font-semibold leading-snug line-clamp-2">
          {image().title || "Untitled"}
        </h2>
      </a>

      {/* Image / GIF — clicking navigates to detail */}
      <div
        class="relative w-full bg-black overflow-hidden cursor-pointer"
        style={{
          "aspect-ratio": "1 / 1",
          "view-transition-name": `image-${image().id}`,
        }}
        onClick={(e) => {
          if ((e.target as Element).closest("button")) return;
          navigate(`/images/${image().id}`);
        }}
      >
        {/* Blurred backdrop — fills letterbox/pillarbox for all media types */}
        <Show when={thumbUrl()}>
          {(url) => (
            <img
              src={url()}
              alt=""
              class="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-60"
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          )}
        </Show>

        <Show
          when={displayUrl()}
          fallback={
            <div class="relative z-10 w-full h-full bg-[var(--color-surface-3)] flex flex-col items-center justify-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-[var(--color-text-muted)] opacity-50"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              <span class="text-[var(--color-text-muted)] text-xs">
                Unavailable
              </span>
            </div>
          }
        >
          {(url) => (
            <Show
              when={isVideo()}
              fallback={
                <img
                  src={url()}
                  alt={image().title || "Photo"}
                  class="absolute inset-0 w-full h-full object-contain z-10"
                  decoding="async"
                />
              }
            >
              <video
                ref={videoEl}
                src={url()}
                poster={thumbUrl() ?? undefined}
                class="relative z-10 w-full h-full object-contain"
                preload="metadata"
                loop={true}
                muted={true}
                playsinline={true}
                controls
              />
            </Show>
          )}
        </Show>
      </div>

      {/* Studio meta */}
      <Show when={image().studio}>
        <div class="px-4 pt-2 text-xs text-[var(--color-text-muted)]">
          <a
            href={`/studios/${image().studio!.id}`}
            class="hover:text-[var(--color-text)] transition-colors"
          >
            {image().studio!.name}
          </a>
        </div>
      </Show>

      {/* Action bar */}
      <div class="px-4 py-3 flex items-center gap-2">
        <VoteButton
          imageId={image().id}
          initialCount={image().o_counter ?? 0}
          type="o_counter"
          label="Upvote"
          title={image().title ?? undefined}
          thumbnailUrl={image().paths.thumbnail ?? undefined}
        />
        <a
          href={`/images/${image().id}`}
          class="inline-flex items-center gap-1.5 px-3 rounded-full text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-3)] border border-[var(--color-border)] active:scale-95 transition-all hover:text-[var(--color-text)] min-h-[44px]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            />
          </svg>
          Comments
        </a>
        <button
          onClick={handleShare}
          aria-label="Share"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-3)] border border-[var(--color-border)] active:scale-95 transition-all hover:text-[var(--color-text)]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
            />
            <polyline
              stroke-linecap="round"
              stroke-linejoin="round"
              points="16 6 12 2 8 6"
            />
            <line stroke-linecap="round" x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      </div>
    </article>
  );
}
