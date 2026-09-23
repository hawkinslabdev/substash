export type ToastVariant = "default" | "error";

// Long enough to read: 4s floor, plus ~60ms per character
export function showToast(
  message: string,
  duration = Math.max(4000, 1500 + message.length * 60),
  variant: ToastVariant = "default",
) {
  window.dispatchEvent(
    new CustomEvent("substash:toast", {
      detail: { message, duration, variant },
    }),
  );
}
