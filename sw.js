const CACHE = "date-calendar-v1";
const PRECACHE = ["/icon.svg", "/icon-192.png", "/icon-512.png", "/favicon.svg", "/manifest.json"];

function shouldBypass(url) {
  const path = url.pathname;
  return (
    path.includes("/@") ||
    path.startsWith("/src/") ||
    path.startsWith("/node_modules/") ||
    path.includes("__vite") ||
    path.startsWith("/__grok/") ||
    path.endsWith(".hot-update.js") ||
    path.endsWith(".hot-update.json") ||
    path.endsWith("/sw.js")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            const res = await fetch(path, { cache: "reload" });
            if (res.ok) await cache.put(path, res);
          } catch {
            // A missing icon must not block installation of the worker.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") {
      try {
        await cache.put(req, res.clone());
      } catch {
        // Some responses (partial, opaque) cannot be stored.
      }
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      const shell = await cache.match("/");
      if (shell) return shell;
    }
    throw err;
  }
}
