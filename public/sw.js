const CACHE_PREFIX = "xtrainer-user-";
const CACHE = `${CACHE_PREFIX}__BUILD_VERSION__`;
const ASSETS = ["./", "./manifest.webmanifest?v=__BUILD_VERSION__", "./xtrainer-user-icon-192.png?v=__BUILD_VERSION__", "./xtrainer-user-icon-512.png?v=__BUILD_VERSION__", "./xtrainer-user-icon-maskable-512.png?v=__BUILD_VERSION__"];
self.addEventListener("install", event => event.waitUntil(Promise.all([caches.open(CACHE).then(cache => cache.addAll(ASSETS)), self.skipWaiting()])));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; })));
});
