import { createSignal } from "solid-js";
import { showToast } from "@/lib/utils/toast";

export interface VoteStore {
  count: () => number;
  voted: () => boolean;
  pending: () => boolean;
  /** Optimistic like. Resolves true when a like was actually fired. */
  vote: () => Promise<boolean>;
}

export interface VoteOpts {
  id: string;
  mediaType: "scene" | "image";
  type?: "o_counter" | "play_count";
  initialCount: number;
  title?: string;
  thumbnailUrl?: string;
}

// Module-level store map: Astro islands are isolated Solid trees, but they
// share the same module graph, so this keeps like state in sync between the
// in-media action rail and the page-level vote button for the same media.
const stores = new Map<string, VoteStore>();

export function useVote(opts: VoteOpts): VoteStore {
  const key = `${opts.mediaType}:${opts.id}:${opts.type ?? "o_counter"}`;
  const existing = stores.get(key);
  if (existing) return existing;

  const [count, setCount] = createSignal(opts.initialCount);
  const [voted, setVoted] = createSignal(false);
  const [pending, setPending] = createSignal(false);

  async function vote(): Promise<boolean> {
    if (pending() || voted()) return false;
    setPending(true);
    setCount((c) => c + 1);
    setVoted(true);
    navigator.vibrate?.(10);
    try {
      const res = await fetch("/api/stash/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: opts.id,
          type: opts.type ?? "o_counter",
          mediaType: opts.mediaType,
          title: opts.title,
          thumbnailUrl: opts.thumbnailUrl,
        }),
      });
      if (!res.ok) {
        setCount((c) => c - 1);
        setVoted(false);
        return false;
      }
      showToast("Liked");
      return true;
    } catch {
      setCount((c) => c - 1);
      setVoted(false);
      return false;
    } finally {
      setPending(false);
    }
  }

  const store: VoteStore = { count, voted, pending, vote };
  stores.set(key, store);
  return store;
}
