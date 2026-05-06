export function showToast(message: string, duration = 2500) {
  window.dispatchEvent(
    new CustomEvent("substash:toast", { detail: { message, duration } }),
  );
}
