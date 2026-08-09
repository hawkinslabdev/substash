import RichTextEditor from "@/components/ui/RichTextEditor.solid";
import { createSignal } from "solid-js";
import { showToast } from "@/lib/utils/toast";
import type { Comment } from "@/lib/db/schema";

interface Props {
  stashId: string;
  mediaType: "scene" | "image";
  parentId?: string;
  title?: string;
  thumbnailUrl?: string;
  onPosted?: (id: string) => void;
  placeholder?: string;
}

export default function CommentForm(props: Props) {
  const [pending, setPending] = createSignal(false);

  async function handleSubmit(html: string) {
    if (pending()) return;
    setPending(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stashId: props.stashId,
          mediaType: props.mediaType,
          parentId: props.parentId,
          body: html,
          metadata:
            props.title || props.thumbnailUrl
              ? { title: props.title, thumbnailUrl: props.thumbnailUrl }
              : undefined,
        }),
      });
      const posted: Comment | null = res.ok ? await res.json() : null;
      showToast(props.parentId ? "Reply posted" : "Comment posted");
      if (posted) props.onPosted?.(posted.id);
    } finally {
      setPending(false);
    }
  }

  return (
    <RichTextEditor
      onSubmit={handleSubmit}
      pending={pending()}
      placeholder={props.placeholder ?? "What are your thoughts?"}
    />
  );
}
