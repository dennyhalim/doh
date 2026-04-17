const CACHE = "pwd-gen-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/dict/en.txt",
  "/dict/id.txt"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});