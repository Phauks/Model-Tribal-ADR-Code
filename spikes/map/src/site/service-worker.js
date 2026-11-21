// Precache the page and its files so the map works offline after the first visit.
const cacheName = "map-spike-1";
const files = ["./", "index.html", "map.css", "map.js", "manifest.webmanifest", "AtkinsonHyperlegibleNext-Regular.ttf"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
