// 音域アタック Service Worker
// 静的アセットをキャッシュし、測定・トレーニングのオフライン動作を支える。
// APIはネットワーク優先(オフライン時は失敗を許容し、クライアント側で案内)。

const CACHE_NAME = "onikiattack-v3";
const PRECACHE = ["/", "/measure", "/songs", "/training", "/progress", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * App Router のクライアント遷移は同じURLに RSC ペイロードを要求する。
 * HTML のキャッシュを誤って返すと遷移が壊れるため、RSC要求は素通しする。
 * (レスポンスの Vary でも弾けるが、意図を明示して取りこぼしを防ぐ)
 */
function isRscRequest(request, url) {
  return (
    request.headers.has("RSC") ||
    request.headers.get("Accept")?.includes("text/x-component") ||
    url.searchParams.has("_rsc")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isRscRequest(request, url)) return;

  // APIはネットワーク優先
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // ハッシュ付きビルド成果物は内容不変。キャッシュにあればネットワークに出ない
  const isImmutable = url.pathname.startsWith("/_next/static/");

  // 静的アセット・ページはキャッシュ優先+バックグラウンド更新
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && isImmutable) return cached;
      const fetched = fetch(request)
        .then((res) => {
          // opaque/エラー応答をキャッシュに焼き付けない
          if (res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? fetched;
    })
  );
});
