export type ToastVariant = "default" | "error";

export function showToast(message: string, duration = 2500, variant: ToastVariant = "default") {
  window.dispatchEvent(
    new CustomEvent("substash:toast", { detail: { message, duration, variant } }),
  );
}
