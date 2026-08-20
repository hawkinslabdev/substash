import { createSignal, createResource, Show, onMount } from "solid-js";
import CommentThread from "./CommentThread.solid";
import CommentForm from "./CommentForm.solid";
import type { Comment } from "@/lib/db/schema";

interface Props {
  stashId: string;
  mediaType: "scene" | "image";
  title?: string;
  thumbnailUrl?: string;
}

async function fetchComments(stashId: string): Promise<Comment[]> {
  const res = await fetch(
    `/api/comments?stashId=${encodeURIComponent(stashId)}`,
  );
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

function CommentSkeleton() {
  return (
    <div class="space-y-2">
      <div class="skeleton-shimmer h-14 rounded-inner" />
      <div class="skeleton-shimmer h-10 rounded-inner opacity-60 ml-4" />
    </div>
  );
}

export default function CommentSection(props: Props) {
  // Arriving from a card's Comments button (/scenes/1#comments). The anchor is
  // above this island, so its offset is settled by the time we mount.
  onMount(() => {
    if (location.hash !== "#comments") return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      document.getElementById("comments")?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      }),
    );
  });

  const [refetchKey, setRefetchKey] = createSignal(0);
  const [highlightId, setHighlightId] = createSignal<string | null>(null);
  const [comments] = createResource(
    () => [props.stashId, refetchKey()] as const,
    ([id]) => fetchComments(id),
  );

  function handlePosted(id: string) {
    setHighlightId(id);
    setRefetchKey((k) => k + 1);
    window.dispatchEvent(
      new CustomEvent("substash:comment-posted", {
        detail: { stashId: props.stashId },
      }),
    );
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 2000);
  }

  return (
    <section class="px-4 pb-6 space-y-3">
      <h2 class="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide pt-4">
        Comments
      </h2>
      <Show when={!comments.loading} fallback={<CommentSkeleton />}>
        <Show when={comments.error}>
          <div class="flex items-center justify-between py-1">
            <p class="text-sm text-[var(--color-text-muted)]">
              Couldn't load comments.
            </p>
            <button
              onClick={() => setRefetchKey((k) => k + 1)}
              class="text-xs text-[var(--color-accent)] hover:underline min-h-0 h-auto"
            >
              Retry
            </button>
          </div>
        </Show>
        <Show
          when={!comments.error && (comments() ?? []).length > 0}
          fallback={
            <Show when={!comments.error}>
              <p class="text-sm text-[var(--color-text-muted)]">
                Be the first to comment.
              </p>
            </Show>
          }
        >
          <CommentThread
            comments={comments() ?? []}
            stashId={props.stashId}
            mediaType={props.mediaType}
            title={props.title}
            thumbnailUrl={props.thumbnailUrl}
            onRefetch={() => setRefetchKey((k) => k + 1)}
            onPosted={handlePosted}
            highlightId={highlightId()}
          />
        </Show>
      </Show>
      <CommentForm
        stashId={props.stashId}
        mediaType={props.mediaType}
        title={props.title}
        thumbnailUrl={props.thumbnailUrl}
        onPosted={handlePosted}
      />
    </section>
  );
}
