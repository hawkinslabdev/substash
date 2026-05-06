import { createSignal, onMount, onCleanup } from "solid-js";

export default function Toast() {
  const [message, setMessage] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout>;

  onMount(() => {
    function handler(e: Event) {
      const { message: msg, duration } = (
        e as CustomEvent<{ message: string; duration: number }>
      ).detail;
      setMessage(msg);
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
      <div class="px-4 py-2.5 rounded-full bg-[var(--color-surface-3)] border border-[var(--color-border)] text-sm text-[var(--color-text)] shadow-lg whitespace-nowrap">
        {message() ?? ""}
      </div>
    </div>
  );
}
