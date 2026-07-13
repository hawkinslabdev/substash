import { Show, createSignal, onMount, onCleanup } from "solid-js";
import { navigate } from "astro:transitions/client";
import { prefetch } from "astro:prefetch";
import VoteButton from "@/components/post/VoteButton.solid";
import MediaActionRail from "./MediaActionRail.solid";
import { proxyImage } from "@/lib/stash/image";
import { timeAgo } from "@/lib/utils/markdown";
import { shareMedia } from "@/lib/utils/share";
import { useVote } from "@/lib/hooks/useVote";
import type { ImageFeedItem } from "@/lib/stash/feed-item";

interface Props {
  image: ImageFeedItem;
  class?: string;
}

export default function ImageCard(props: Props) {
  const image = () => props.image;
  const isVideo = () => !!image().paths.preview;
  let videoEl: HTMLVideoElement | undefined;

  // Double-tap media = like (with center heart burst); single tap navigates
  // after the double-tap detection window.
  const vote = useVote({
    id: props.image.id,
    mediaType: "image",
    initialCount: props.image.o_counter ?? 0,
    title: props.image.title ?? undefined,
    thumbnailUrl: props.image.paths.thumbnail ?? undefined,
  });
  const [heart, setHeart] = createSignal(false);
  let tapTimer: number | undefined;

  function handleMediaClick(e: MouseEvent) {
    if ((e.target as Element).closest("button")) return;
    if (tapTimer !== undefined) {
      clearTimeout(tapTimer);
      tapTimer = undefined;
      setHeart(false);
      requestAnimationFrame(() => setHeart(true));
      setTimeout(() => setHeart(false), 800);
      vote.vote();
      return;
    }
    // Warm the detail route during the double-tap window so the eventual
    // navigation feels instant.
    prefetch(`/images/${image().id}`);
    tapTimer = window.setTimeout(() => {
      tapTimer = undefined;
      navigate(`/images/${image().id}`);
    }, 260);
  }

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

  function handleShare() {
    shareMedia(image().id, "image", image().title);
  }

  return (
    <article
      class={`feed-item flex flex-col bg-[var(--color-surface)] ${props.class ?? ""}`}
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

      {/* Title above the media */}
      <a
        href={`/images/${image().id}`}
        class="block px-4 pb-2 min-h-0 min-w-0 hover:text-[var(--color-accent)] transition-colors"
        data-astro-prefetch="viewport"
      >
        <h2 class="text-[17px] font-semibold leading-snug tracking-[-0.01em] line-clamp-2 [text-wrap:balance]">
          {image().title || "Untitled"}
        </h2>
      </a>

      {/* Image / GIF clicking navigates to detail */}
      <div
        class="media-frame relative w-full bg-black overflow-hidden cursor-pointer"
        style={{
          "aspect-ratio": "1 / 1",
          "view-transition-name": `image-${image().id}`,
        }}
        onClick={handleMediaClick}
      >
        {/* Blurred backdrop fills letterbox/pillarbox for all media types */}
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
                  loading="lazy"
                  decoding="async"
                />
              }
            >
              <video
                ref={videoEl}
                src={url()}
                poster={thumbUrl() ?? undefined}
                class="relative z-10 w-full h-full object-contain"
                preload="none"
                loop={true}
                muted={true}
                playsinline={true}
              />
            </Show>
          )}
        </Show>

        <MediaActionRail
          mediaId={image().id}
          mediaType="image"
          initialLikes={image().o_counter ?? 0}
          commentCount={image().commentCount}
          title={image().title}
          thumbnailUrl={image().paths.thumbnail ?? undefined}
        />

        {/* Double-tap heart burst */}
        <Show when={heart()}>
          <div class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <svg
              class="heart-burst"
              width="72"
              height="72"
              viewBox="0 0 24 24"
              fill="white"
              style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.45))" }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
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
          class="inline-flex items-center gap-1.5 px-3 rounded-full text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-3)] active:scale-95 transition-all hover:text-[var(--color-text)] min-h-[44px]"
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
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-3)] active:scale-95 transition-all hover:text-[var(--color-text)]"
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
