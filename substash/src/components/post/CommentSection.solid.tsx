import { createSignal, createResource, Show } from "solid-js";
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
  return res.json();
}

export default function CommentSection(props: Props) {
  const [refetchKey, setRefetchKey] = createSignal(0);
  const [comments] = createResource(
    () => [props.stashId, refetchKey()] as const,
    ([id]) => fetchComments(id),
  );

  return (
    <section class="px-4 pb-6 space-y-3">
      <h2 class="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide pt-4">
        Comments
      </h2>
      <Show
        when={!comments.loading}
        fallback={
          <p class="text-sm text-[var(--color-text-muted)]">Loading…</p>
        }
      >
        <Show
          when={(comments() ?? []).length > 0}
          fallback={
            <p class="text-sm text-[var(--color-text-muted)]">
              Be the first to comment.
            </p>
          }
        >
          <CommentThread
            comments={comments() ?? []}
            stashId={props.stashId}
            mediaType={props.mediaType}
            title={props.title}
            thumbnailUrl={props.thumbnailUrl}
            onRefetch={() => setRefetchKey((k) => k + 1)}
          />
        </Show>
      </Show>
      <CommentForm
        stashId={props.stashId}
        mediaType={props.mediaType}
        title={props.title}
        thumbnailUrl={props.thumbnailUrl}
        onPosted={() => setRefetchKey((k) => k + 1)}
      />
    </section>
  );
}
