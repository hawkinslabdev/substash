import {
  Show,
  Suspense,
  createEffect,
  createSignal,
  lazy,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";

// Lazy: keeps the comment editor out of the feed bundle until a sheet opens
const CommentSection = lazy(
  () => import("@/components/post/CommentSection.solid"),
);

interface Props {
  open: boolean;
  onClose: () => void;
  stashId: string;
  mediaType: "scene" | "image";
  title?: string;
  thumbnailUrl?: string;
}

/**
 * Bottom sheet wrapping CommentSection — lets the user read and write
 * comments while the media keeps playing behind it. Drag down or tap the
 * backdrop to dismiss.
 */
export default function CommentSheet(props: Props) {
  const [shown, setShown] = createSignal(false);
  const [dragY, setDragY] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  let touchStartY = 0;
  let touchStartT = 0;

  createEffect(() => {
    if (props.open) {
      document.body.style.overflow = "hidden";
      // Mount first, then slide in on the next frame
      requestAnimationFrame(() => setShown(true));
      document.addEventListener("keydown", onKeydown);
    } else {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      setShown(false);
      setDragY(0);
    }
  });
  onCleanup(() => {
    // Also runs during SSR disposal, where browser APIs don't exist
    if (typeof document === "undefined") return;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
  });

  function requestClose() {
    setShown(false);
    setTimeout(() => props.onClose(), 320);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") requestClose();
  }

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    touchStartT = performance.now();
    setDragging(true);
  }
  function onTouchMove(e: TouchEvent) {
    if (!dragging()) return;
    const dy = e.touches[0].clientY - touchStartY;
    setDragY(Math.max(0, dy));
  }
  function onTouchEnd() {
    if (!dragging()) return;
    setDragging(false);
    const dy = dragY();
    const velocity = dy / Math.max(1, performance.now() - touchStartT);
    if (dy > 120 || velocity > 0.5) {
      requestClose();
    } else {
      setDragY(0);
    }
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 z-[90]"
          role="dialog"
          aria-modal="true"
          aria-label="Comments"
        >
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/40 transition-opacity duration-300"
            classList={{ "opacity-0": !shown() }}
            onClick={requestClose}
          />
          {/* Sheet */}
          <div
            class="glass-strong absolute bottom-0 inset-x-0 lg:max-w-[720px] lg:mx-auto rounded-t-[var(--radius-sheet)] flex flex-col"
            style={{
              height: "75dvh",
              "border-bottom": "0",
              transform: shown()
                ? `translateY(${dragY()}px)`
                : "translateY(100%)",
              transition: dragging()
                ? "none"
                : "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
              "padding-bottom": "env(safe-area-inset-bottom)",
            }}
          >
            {/* Drag handle */}
            <div
              class="flex justify-center pt-3 pb-2 shrink-0 cursor-grab touch-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div class="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <Suspense
                fallback={
                  <div class="p-4 space-y-3" aria-hidden="true">
                    <div class="skeleton-shimmer h-10 w-full" />
                    <div class="skeleton-shimmer h-4 w-2/3" />
                    <div class="skeleton-shimmer h-4 w-1/2 opacity-60" />
                  </div>
                }
              >
                <CommentSection
                  stashId={props.stashId}
                  mediaType={props.mediaType}
                  title={props.title}
                  thumbnailUrl={props.thumbnailUrl}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
