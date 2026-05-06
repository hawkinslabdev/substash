import { onMount } from "solid-js";

export default function PinGate() {
  onMount(async () => {
    if (
      import.meta.env.PUBLIC_AUTH_COOKIE_SECURE === true ||
      import.meta.env.PUBLIC_AUTH_COOKIE_SECURE === "true"
    )
      return;

    try {
      const settingsRes = await fetch("/api/settings");
      const { pinEnabled } = await settingsRes.json();
      if (!pinEnabled) return;
    } catch {
      return;
    }

    const token = localStorage.getItem("substash:session");
    if (!token) {
      window.location.href = `/auth?from=${encodeURIComponent(location.pathname)}`;
      return;
    }

    try {
      const res = await fetch("/api/auth/check", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { valid } = await res.json();
      if (!valid) {
        localStorage.removeItem("substash:session");
        window.location.href = `/auth?from=${encodeURIComponent(location.pathname)}`;
      }
    } catch {
      // network error — don't block
    }
  });

  return null;
}
