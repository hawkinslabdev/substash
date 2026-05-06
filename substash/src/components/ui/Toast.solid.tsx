import { createSignal, onMount, onCleanup, Show } from "solid-js";
import type { ToastVariant } from "@/lib/utils/toast";

export default function Toast() {
  const [message, setMessage] = createSignal<string | null>(null);
  const [variant, setVariant] = createSignal<ToastVariant>("default");
  let timer: ReturnType<typeof setTimeout>;

  onMount(() => {
    function handler(e: Event) {
      const { message: msg, duration, variant: v } = (
        e as CustomEvent<{ message: string; duration: number; variant?: ToastVariant }>
      ).detail;
      setMessage(msg);
      setVariant(v ?? "default");
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), duration);
    }
    window.addEventListener("substash:toast", handler);
    onCleanup(() => {
      window.removeEventListener("substash:toast", handler);
      clearTimeout(timer);
    });
  });

  return (
    <div
      class="fixed inset-x-4 z-[100] flex justify-center pointer-events-none transition-all duration-200"
      style={{
        bottom: `calc(var(--bottom-nav-height) + 12px)`,
        opacity: message() ? 1 : 0,
        transform: message() ? "translateY(0)" : "translateY(6px)",
      }}
    >
      <div
        class={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm shadow-lg whitespace-nowrap ${
          variant() === "error"
            ? "bg-[var(--color-surface-3)] border border-rose-800/40 text-[var(--color-text)]"
            : "bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)]"
        }`}
      >
        <Show when={variant() === "error"}>
          <span
            class="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500/70"
            aria-hidden="true"
          />
        </Show>
        {message() ?? ""}
      </div>
    </div>
  );
}
