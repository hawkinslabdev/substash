import { createSignal, For, Show } from "solid-js";
import CommentForm from "./CommentForm.solid";
import { renderMarkdown, timeAgo } from "@/lib/utils/markdown";
import { sanitize } from "@/lib/utils/sanitize";
import { showToast } from "@/lib/utils/toast";
import type { Comment } from "@/lib/db/schema";

function renderBody(body: string): string {
  // WYSIWYG editor stores HTML (starts with a block tag); old comments are plain text / markdown
  return body.trimStart().startsWith("<")
    ? sanitize(body)
    : renderMarkdown(body);
}

interface Props {
  comments: Comment[];
  stashId: string;
  mediaType: "scene" | "image";
  title?: string;
  thumbnailUrl?: string;
  onRefetch?: () => void;
  onPosted?: (id: string) => void;
  parentId?: string | null;
  depth?: number;
  highlightId?: string | null;
}

export default function CommentThread(props: Props) {
  const [replyingTo, setReplyingTo] = createSignal<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = createSignal<string | null>(
    null,
  );

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Comment deleted");
      props.onRefetch?.();
    } else {
      showToast("Failed to delete comment", 3000, "error");
    }
    setConfirmingDelete(null);
  }

  const children = () =>
    props.comments.filter(
      (c) => (c.parentId ?? null) === (props.parentId ?? null),
    );

  return (
    <ul
      class={
        props.depth
          ? "ml-4 border-l border-[var(--color-border)] pl-3"
          : "space-y-3"
      }
    >
      <For each={children()}>
        {(comment) => {
          const date = new Date(comment.createdAt);
          const fullDate = date.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          });

          return (
            <li class="space-y-1">
              <div
                class="rounded-lg bg-[var(--color-surface-3)] p-3 text-sm"
                classList={{
                  "comment-highlight": comment.id === props.highlightId,
                }}
              >
                <div
                  class="md-body text-[var(--color-text)] leading-relaxed"
                  innerHTML={renderBody(comment.body)}
                />
                <div class="mt-2 flex items-center gap-3">
                  <time
                    class="text-[10px] text-[var(--color-text-muted)]"
                    dateTime={date.toISOString()}
                    title={fullDate}
                  >
                    {timeAgo(date)}
                  </time>
                  <Show
                    when={confirmingDelete() === comment.id}
                    fallback={
                      <>
                        <button
                          onClick={() =>
                            setReplyingTo(
                              replyingTo() === comment.id ? null : comment.id,
                            )
                          }
                          class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors min-h-0 min-w-0 h-auto"
                        >
                          {replyingTo() === comment.id ? "Cancel" : "Reply"}
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(comment.id)}
                          class="text-[10px] text-[var(--color-text-muted)] hover:text-rose-400 transition-colors min-h-0 min-w-0 h-auto"
                        >
                          Delete
                        </button>
                      </>
                    }
                  >
                    <span class="text-[10px] text-[var(--color-text-muted)]">
                      Delete?
                    </span>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      class="text-[10px] text-rose-400 hover:text-rose-300 transition-colors min-h-0 min-w-0 h-auto"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors min-h-0 min-w-0 h-auto"
                    >
                      No
                    </button>
                  </Show>
                </div>
              </div>

              <Show when={replyingTo() === comment.id}>
                <div class="ml-4">
                  <CommentForm
                    stashId={props.stashId}
                    mediaType={props.mediaType}
                    parentId={comment.id}
                    title={props.title}
                    thumbnailUrl={props.thumbnailUrl}
                    placeholder="Write a reply…"
                    onPosted={(id) => {
                      setReplyingTo(null);
                      props.onPosted?.(id);
                    }}
                  />
                </div>
              </Show>

              <Show
                when={props.comments.some((c) => c.parentId === comment.id)}
              >
                <CommentThread
                  comments={props.comments}
                  stashId={props.stashId}
                  mediaType={props.mediaType}
                  title={props.title}
                  thumbnailUrl={props.thumbnailUrl}
                  onRefetch={props.onRefetch}
                  onPosted={props.onPosted}
                  parentId={comment.id}
                  depth={(props.depth ?? 0) + 1}
                  highlightId={props.highlightId}
                />
              </Show>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
