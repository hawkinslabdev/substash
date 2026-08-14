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

// Lets sibling islands (immersive arrow-key pager) stand down while a sheet is up
const [openCount, setOpenCount] = createSignal(0);
export const anySheetOpen = () => openCount() > 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [contenteditable], [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet wrapping CommentSection, lets the user read and write
 * comments while the media keeps playing behind it. Drag down or tap the
 * backdrop to dismiss.
 */
export default function CommentSheet(props: Props) {
  const [shown, setShown] = createSignal(false);
  const [dragY, setDragY] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  let touchStartY = 0;
  let touchStartT = 0;
  let sheet: HTMLDivElement | undefined;
  let dialog: HTMLDivElement | undefined;
  let prevFocus: HTMLElement | null = null;
  let counted = false;

  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1023px)").matches;

  /** Track the real visible area so the sheet stays put when the on-screen
   *  keyboard opens, iOS/Android don't shrink `dvh`/fixed positioning for
   *  the keyboard, so without this the sheet (and its Post button) can drift
   *  out from under the finger, letting taps fall through to whatever is
   *  behind it. */
  function syncViewport() {
    const vv = window.visualViewport;
    if (!vv || !dialog || !isMobile()) return;
    dialog.style.height = `${vv.height}px`;
    dialog.style.width = `${vv.width}px`;
    dialog.style.left = `${vv.offsetLeft}px`;
    dialog.style.top = `${vv.offsetTop}px`;
  }

  function clearViewportOverride() {
    if (!dialog) return;
    dialog.style.removeProperty("height");
    dialog.style.removeProperty("width");
    dialog.style.removeProperty("left");
    dialog.style.removeProperty("top");
  }

  /** Focus the top-level comment field (not a reply box) once it mounts —
   *  RichTextEditor is lazy-loaded behind Suspense, so it isn't in the DOM
   *  the instant the sheet opens. Falls back to the sheet container so
   *  keyboard/focus-trap behavior still works if the editor never appears. */
  function focusEditor(deadline = performance.now() + 2000) {
    const editable = sheet?.querySelector<HTMLElement>("[contenteditable]");
    if (editable) {
      editable.focus();
      return;
    }
    if (performance.now() < deadline) {
      requestAnimationFrame(() => focusEditor(deadline));
    } else {
      sheet?.focus();
    }
  }

  createEffect(() => {
    if (props.open) {
      if (!counted) {
        counted = true;
        setOpenCount((n) => n + 1);
      }
      document.body.style.overflow = "hidden";
      prevFocus = document.activeElement as HTMLElement | null;
      // Mount first, then slide in on the next frame
      requestAnimationFrame(() => {
        setShown(true);
        focusEditor();
      });
      document.addEventListener("keydown", onKeydown);
      syncViewport();
      window.visualViewport?.addEventListener("resize", syncViewport);
      window.visualViewport?.addEventListener("scroll", syncViewport);
    } else {
      release();
      setShown(false);
      setDragY(0);
    }
  });
  onCleanup(() => {
    // Also runs during SSR disposal, where browser APIs don't exist
    if (typeof document === "undefined") return;
    release();
  });

  /** Undo what open took over: scroll lock, keys, focus, counter, viewport tracking */
  function release() {
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    window.visualViewport?.removeEventListener("resize", syncViewport);
    window.visualViewport?.removeEventListener("scroll", syncViewport);
    clearViewportOverride();
    if (counted) {
      counted = false;
      setOpenCount((n) => Math.max(0, n - 1));
    }
    prevFocus?.focus();
    prevFocus = null;
  }

  function requestClose() {
    setShown(false);
    setTimeout(() => props.onClose(), 320);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      requestClose();
      return;
    }
    if (e.key !== "Tab" || !sheet) return;
    // Queried per keypress: the comment body mounts lazily via Suspense
    const items = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!sheet.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
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
        {/* Desktop: live inside the content column so the sheet lines up with its media.
            Mobile position/size is kept in sync with the real visual viewport via JS
            (see syncViewport) so the keyboard can't push content out from under a tap. */}
        <div
          ref={dialog}
          class="fixed inset-0 z-[90] lg:left-[var(--sidebar-width-desktop)] lg:top-[var(--header-height)]"
          role="dialog"
          aria-modal="true"
          aria-label="Comments"
        >
          {/* Swallows wheel/touch: the immersive pager scrolls itself, not the document */}
          <div
            class="absolute inset-0 bg-black/40 transition-opacity duration-300 touch-none"
            classList={{ "opacity-0": !shown() }}
            onClick={requestClose}
            onWheel={(e) => e.preventDefault()}
          />
          {/* Sheet */}
          <div
            ref={sheet}
            tabindex="-1"
            class="glass-strong absolute bottom-0 inset-x-0 lg:max-w-[720px] lg:mx-auto rounded-t-[var(--radius-sheet)] flex flex-col focus:outline-none"
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
