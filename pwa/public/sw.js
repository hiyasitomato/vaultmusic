const CACHE_NAME = "vaultmusic-shell-v2";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg"];
const MEDIA_PREFIX = "/media/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function handleMedia(request) {
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));
  const token = url.searchParams.get("t") || "";
  if (!id || !token) return new Response("Bad request", { status: 400 });

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  let upstream;
  try {
    upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        id
      )}?alt=media&supportsAllDrives=true`,
      { headers }
    );
  } catch {
    return new Response("upstream error", { status: 502 });
  }
  if (!upstream.ok) return upstream;

  const out = new Headers();
  const type = upstream.headers.get("content-type") || "";
  out.set("Content-Type", type.startsWith("audio/") ? type : "audio/mpeg");
  out.set("Accept-Ranges", "bytes");
  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  if (contentLength) out.set("Content-Length", contentLength);
  if (contentRange) out.set("Content-Range", contentRange);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(MEDIA_PREFIX)) {
    event.respondWith(handleMedia(event.request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => undefined);
          }
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
