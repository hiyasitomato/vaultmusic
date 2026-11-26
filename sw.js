const CACHE_NAME = "vaultmusic-shell-v3";

function scopePath() {
  try {
    return new URL(self.registration.scope).pathname;
  } catch {
    return "/";
  }
}

self.addEventListener("install", (event) => {
  const scope = scopePath();
  const assets = [scope, `${scope}manifest.webmanifest`, `${scope}icon.svg`];
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(assets))
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
  const scope = scopePath();
  const prefix = `${scope}media/`;
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.slice(prefix.length));
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
      { headers, priority: "high" }
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

  const scope = scopePath();
  const mediaPrefix = `${scope}media/`;

  if (url.pathname.startsWith(mediaPrefix)) {
    event.respondWith(handleMedia(event.request));
    return;
  }

  if (
    url.pathname.includes("/_next/static/") ||
    url.pathname === `${scope}icon.svg` ||
    url.pathname === `${scope}manifest.webmanifest`
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
