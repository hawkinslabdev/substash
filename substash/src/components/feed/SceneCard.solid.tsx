import { Show, createSignal } from "solid-js";
import { navigate } from "astro:transitions/client";
import { prefetch } from "astro:prefetch";
import VideoPlayer from "./VideoPlayer.solid";
import MediaActionRail from "./MediaActionRail.solid";
import VoteButton from "@/components/post/VoteButton.solid";
import { cn } from "@/lib/utils/cn";
import { proxyImage } from "@/lib/stash/image";
import { timeAgo } from "@/lib/utils/markdown";
import { formatCount } from "@/lib/utils/format";
import { shareMedia } from "@/lib/utils/share";
import { useVote } from "@/lib/hooks/useVote";
import type { SceneFeedItem } from "@/lib/stash/feed-item";

interface Props {
  scene: SceneFeedItem;
  class?: string;
}

export default function SceneCard(props: Props) {
  const scene = () => props.scene;
  const streamUrl = () => scene().paths.stream ?? "";
  const posterUrl = () => proxyImage(scene().paths.screenshot);
  const file = () => scene().files[0];
  const mediaAspect = () =>
    file() ? `${file()!.width} / ${file()!.height}` : "16 / 9";
  const isPortrait = () => (file() ? file()!.height > file()!.width : false);

  function handleShare() {
    shareMedia(scene().id, "scene", scene().title);
  }

  // Double-tap media = like (with center heart burst); single tap navigates
  // after the double-tap detection window.
  const vote = useVote({
    id: props.scene.id,
    mediaType: "scene",
    initialCount: props.scene.o_counter ?? 0,
    title: props.scene.title ?? undefined,
    thumbnailUrl: props.scene.paths.screenshot ?? undefined,
  });
  const [heart, setHeart] = createSignal(false);
  // Action bar and in-media rail open the same sheet
  const [commentsOpen, setCommentsOpen] = createSignal(false);
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
    prefetch(`/scenes/${scene().id}`);
    tapTimer = window.setTimeout(() => {
      tapTimer = undefined;
      navigate(`/scenes/${scene().id}`);
    }, 260);
  }

  return (
    <article
      class={cn(
        "feed-item flex flex-col bg-[var(--color-surface)]",
        props.class,
      )}
      data-stash-id={scene().id}
      data-stash-type="scene"
    >
      {/* Card header: origin · performer · date */}
      <div class="px-4 pt-3 pb-1.5 flex items-center gap-2">
        <a
          href={
            scene().subredditExtracted
              ? scene().subreddit.startsWith("u_")
                ? `/search?user=${encodeURIComponent(scene().subreddit.slice(2))}`
                : `/search?r=${encodeURIComponent(scene().subreddit)}`
              : "/discover"
          }
          onClick={(e) => e.stopPropagation()}
          class="text-xs font-bold text-[var(--color-accent)] tracking-wide hover:opacity-75 transition-opacity"
        >
          {scene().originDisplay}
        </a>
        <Show when={scene().metaPerformer}>
          <span
            class="text-xs font-bold text-[var(--color-text-muted)]"
            aria-hidden="true"
          >
            ·
          </span>
          <span class="text-xs font-semibold text-[var(--color-text)]">
            {scene().metaPerformer}
          </span>
        </Show>
        <Show when={scene().date || scene().metaDay}>
          <span
            class="text-xs font-bold text-[var(--color-text-muted)]"
            aria-hidden="true"
          >
            ·
          </span>
          <time
            class="text-xs text-[var(--color-text-muted)]"
            datetime={scene().date ?? undefined}
          >
            {scene().metaDay ?? timeAgo(new Date(scene().date! + "T00:00:00"))}
          </time>
        </Show>
      </div>

      {/* Title above the media, Reddit-style */}
      <a
        href={`/scenes/${scene().id}`}
        class="block px-4 pb-2 min-h-0 min-w-0 hover:text-[var(--color-accent)] transition-colors"
        data-astro-prefetch
      >
        <h2 class="text-[17px] font-semibold leading-snug tracking-[-0.01em] line-clamp-2 [text-wrap:balance]">
          {scene().title ?? "Untitled"}
        </h2>
      </a>

      {/* Media clicking anywhere except the mute button navigates to detail */}
      <div
        class={`media-frame relative w-full bg-black overflow-hidden cursor-pointer${isPortrait() ? " portrait" : ""}`}
        style={{
          "aspect-ratio": mediaAspect(),
          "view-transition-name": `scene-${scene().id}`,
        }}
        onClick={handleMediaClick}
      >
        <Show when={posterUrl()}>
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
          when={streamUrl()}
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
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              <span class="text-[var(--color-text-muted)] text-xs">
                Video unavailable
              </span>
            </div>
          }
        >
          <VideoPlayer
            id={scene().id}
            src={streamUrl()}
            poster={posterUrl() ?? undefined}
            class="relative w-full h-full"
            onPlay={() => prefetch(`/scenes/${scene().id}`)}
          />
        </Show>

        <MediaActionRail
          mediaId={scene().id}
          mediaType="scene"
          initialLikes={scene().o_counter ?? 0}
          commentCount={scene().commentCount}
          title={scene().title}
          thumbnailUrl={scene().paths.screenshot ?? undefined}
          sheetOpen={commentsOpen}
          onSheetOpenChange={setCommentsOpen}
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
      <Show when={scene().studio}>
        <div class="px-4 pt-2 text-xs text-[var(--color-text-muted)]">
          <a
            href={`/studios/${scene().studio!.id}`}
            class="hover:text-[var(--color-text)] transition-colors"
          >
            {scene().studio!.name}
          </a>
        </div>
      </Show>

      {/* Action bar */}
      <div class="px-4 py-3 flex items-center gap-2">
        <VoteButton
          sceneId={scene().id}
          initialCount={scene().o_counter ?? 0}
          type="o_counter"
          label="Upvote"
          title={scene().title ?? undefined}
          thumbnailUrl={scene().paths.screenshot ?? undefined}
        />
        <a
          href={`/scenes/${scene().id}#comments`}
          data-astro-prefetch
          class="inline-flex items-center gap-1.5 px-3 rounded-control text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-3)] active:scale-95 transition-all hover:text-[var(--color-text)] min-h-[44px]"
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
          {scene().commentCount ? formatCount(scene().commentCount) : ""}{" "}
          Comments
        </a>
        <button
          onClick={handleShare}
          aria-label="Share"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-control text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-3)] active:scale-95 transition-all hover:text-[var(--color-text)]"
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
