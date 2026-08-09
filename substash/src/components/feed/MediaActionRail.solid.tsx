import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { useVote } from "@/lib/hooks/useVote";
import { formatCount } from "@/lib/utils/format";
import { shareMedia } from "@/lib/utils/share";
import CommentSheet from "@/components/post/CommentSheet.solid";

interface Props {
  mediaId: string;
  mediaType: "scene" | "image";
  initialLikes: number;
  commentCount?: number;
  title?: string | null;
  thumbnailUrl?: string;
  /** Distance from the media's bottom edge, e.g. to clear native video controls */
  bottomOffset?: string;
  /** Immersive mode: never idle-dim, stay at full opacity while visible */
  persistent?: boolean;
  /** Lift sheet state to the parent so a card's action bar can open the same sheet */
  sheetOpen?: () => boolean;
  onSheetOpenChange?: (open: boolean) => void;
}

/**
 * In-media action rail: like / comment / share stacked on the bottom-right
 * edge of the media itself. Fades in when the media is on screen, dims after
 * a few seconds idle, and wakes on any touch of the media.
 * Mounts inside the media container (which must be position:relative).
 */
export default function MediaActionRail(props: Props) {
  let host: HTMLDivElement | undefined;
  const vote = useVote({
    id: props.mediaId,
    mediaType: props.mediaType,
    initialCount: props.initialLikes,
    title: props.title ?? undefined,
    thumbnailUrl: props.thumbnailUrl,
  });

  const [active, setActive] = createSignal(false);
  const [dimmed, setDimmed] = createSignal(false);
  const [localSheetOpen, setLocalSheetOpen] = createSignal(false);
  const sheetOpen = () => props.sheetOpen?.() ?? localSheetOpen();
  const setSheetOpen = (open: boolean) =>
    props.onSheetOpenChange
      ? props.onSheetOpenChange(open)
      : setLocalSheetOpen(open);
  const [likePop, setLikePop] = createSignal(false);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function wake() {
    setDimmed(false);
    if (props.persistent) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setDimmed(true), 3000);
  }

  onMount(() => {
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0].intersectionRatio >= 0.5;
        setActive(visible);
        if (visible) wake();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(host);

    // Any touch on the surrounding media wakes the rail
    const media = host.parentElement;
    media?.addEventListener("pointerdown", wake, { passive: true });

    onCleanup(() => {
      observer.disconnect();
      media?.removeEventListener("pointerdown", wake);
      if (idleTimer) clearTimeout(idleTimer);
    });
  });

  async function handleLike() {
    setLikePop(false);
    requestAnimationFrame(() => setLikePop(true));
    setTimeout(() => setLikePop(false), 400);
    await vote.vote();
  }

  const chip =
    "glass rounded-full w-11 h-11 flex items-center justify-center text-white active:scale-90 transition-transform";
  const countLabel =
    "text-[11px] font-medium text-white tabular-nums [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]";

  return (
    <>
      {/* Contrast scrim — functional: guarantees icon legibility over bright media */}
      <div
        class="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none z-10 transition-opacity duration-300"
        classList={{ "opacity-0": !active() || dimmed() }}
        style={{
          background:
            "linear-gradient(to top, rgb(0 0 0 / 0.45), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div
        ref={host}
        class="absolute right-2 z-20 flex flex-col items-center gap-2.5 transition-opacity duration-300"
        classList={{
          "opacity-0 pointer-events-none": !active(),
          "opacity-40": active() && dimmed(),
          "opacity-100": active() && !dimmed(),
        }}
        style={{ bottom: props.bottomOffset ?? "12px" }}
      >
        {/* Like — icon + count share one hit area so tapping the number also registers */}
        <button
          onClick={handleLike}
          aria-label="Like"
          aria-pressed={vote.voted()}
          class="flex flex-col items-center gap-0.5 min-h-0 min-w-0 h-auto"
        >
          <span class={chip} classList={{ "vote-pop": likePop() }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={vote.voted() ? "var(--color-accent)" : "none"}
              stroke={vote.voted() ? "var(--color-accent)" : "currentColor"}
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              />
            </svg>
          </span>
          <span class={countLabel}>{formatCount(vote.count())}</span>
        </button>

        {/* Comments — icon + count share one hit area so tapping the number also registers */}
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Comments"
          class="flex flex-col items-center gap-0.5 min-h-0 min-w-0 h-auto"
        >
          <span class={chip}>
            <svg
              width="19"
              height="19"
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
          </span>
          <Show when={props.commentCount !== undefined}>
            <span class={countLabel}>{formatCount(props.commentCount!)}</span>
          </Show>
        </button>

        {/* Share */}
        <button
          onClick={() =>
            shareMedia(props.mediaId, props.mediaType, props.title)
          }
          aria-label="Share"
          class={chip}
        >
          <svg
            width="19"
            height="19"
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
        </button>
      </div>

      <CommentSheet
        open={sheetOpen()}
        onClose={() => setSheetOpen(false)}
        stashId={props.mediaId}
        mediaType={props.mediaType}
        title={props.title ?? undefined}
        thumbnailUrl={props.thumbnailUrl}
      />
    </>
  );
}
