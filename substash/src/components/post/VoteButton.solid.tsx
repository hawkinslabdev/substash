import { createSignal } from "solid-js";
import { cn } from "@/lib/utils/cn";
import { formatCount } from "@/lib/utils/format";
import { showToast } from "@/lib/utils/toast";

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
  // No persistent vote memory — each page visit gets a fresh like.
  const [count, setCount] = createSignal(props.initialCount);
  const [pending, setPending] = createSignal(false);
  const [voted, setVoted] = createSignal(false);
  const [bursting, setBursting] = createSignal(false);

  async function handleVote() {
    if (pending() || voted()) return;
    setPending(true);
    setCount((c) => c + 1);
    setVoted(true);

    setBursting(false);
    requestAnimationFrame(() => setBursting(true));
    setTimeout(() => setBursting(false), 400);

    navigator.vibrate?.(10);
    try {
      const res = await fetch("/api/stash/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: props.sceneId ?? props.imageId,
          type: props.type,
          mediaType: props.imageId ? "image" : "scene",
          title: props.title,
          thumbnailUrl: props.thumbnailUrl,
        }),
      });
      if (!res.ok) {
        setCount((c) => c - 1);
        setVoted(false);
      } else {
        showToast("Liked");
      }
    } catch {
      setCount((c) => c - 1);
      setVoted(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={pending()}
      aria-label={props.label ?? "Vote"}
      class={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
        "border border-[var(--color-border)] active:scale-95",
        bursting() && "vote-pop",
        voted()
          ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
          : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
        pending() && "opacity-60 cursor-not-allowed",
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={voted() ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 19V5M5 12l7-7 7 7"
        />
      </svg>
      {formatCount(count())}
    </button>
  );
}
