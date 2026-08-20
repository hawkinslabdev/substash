import { createSignal, For, Show } from "solid-js";
import { cn } from "@/lib/utils/cn";
import { formatCount } from "@/lib/utils/format";
import { useVote } from "@/lib/hooks/useVote";

const PARTICLES = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => ({
  x: Math.round(Math.cos((deg * Math.PI) / 180) * 24),
  y: Math.round(Math.sin((deg * Math.PI) / 180) * 24),
}));

interface Props {
  sceneId?: string;
  imageId?: string;
  initialCount: number;
  type: "o_counter" | "play_count";
  label?: string;
  title?: string;
  thumbnailUrl?: string;
}

export default function VoteButton(props: Props) {
  // Shared per-media store: keeps this button in sync with the in-media
  // action rail. No persistent vote memory, each page visit gets a fresh like.
  const store = useVote({
    id: (props.sceneId ?? props.imageId)!,
    mediaType: props.imageId ? "image" : "scene",
    type: props.type,
    initialCount: props.initialCount,
    title: props.title,
    thumbnailUrl: props.thumbnailUrl,
  });
  const [bursting, setBursting] = createSignal(false);

  async function handleVote() {
    if (store.pending() || store.voted()) return;

    setBursting(false);
    requestAnimationFrame(() => setBursting(true));
    setTimeout(() => setBursting(false), 400);

    await store.vote();
  }

  return (
    <div class="relative inline-flex shrink-0">
      <button
        onClick={handleVote}
        disabled={store.pending()}
        aria-label={props.label ?? "Vote"}
        class={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-sm font-medium tabular-nums transition-all",
          "active:scale-95",
          bursting() && "vote-pop",
          store.voted()
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
          store.pending() && "opacity-60 cursor-not-allowed",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={store.voted() ? "currentColor" : "none"}
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 19V5M5 12l7-7 7 7"
          />
        </svg>
        {formatCount(store.count())}
      </button>
      <Show when={bursting()}>
        <For each={PARTICLES}>
          {(p) => (
            <span
              class="vote-particle"
              style={
                { "--px": `${p.x}px`, "--py": `${p.y}px` } as Record<
                  string,
                  string
                >
              }
            />
          )}
        </For>
      </Show>
    </div>
  );
}
