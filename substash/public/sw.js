// Minimal service worker - no caching for lightweight PWA
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});
