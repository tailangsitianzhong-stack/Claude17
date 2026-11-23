/* チェス道場 Service Worker: オフライン対応
 * - アプリ本体(index.html とハッシュ付きの assets)はビルドごとに作り直す(BUILD の値はビルド時に置換される)
 * - エンジン(Stockfish WASM)とパズルデータは別キャッシュに保存し、再ダウンロードしない
 */
const BUILD = '__BUILD_ID__';
const CORE_CACHE = `chess-dojo-core-${BUILD}`;
const STATIC_CACHE = 'chess-dojo-static-v1'; // エンジン/パズルを差し替えたら v を上げる

const STATIC_URLS = [
  './stockfish/stockfish-18-lite-single.js',
  './stockfish/stockfish-18-lite-single.wasm',
  './puzzles/puzzles.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const core = await caches.open(CORE_CACHE);
      // index.html を読んで、参照している assets を全部キャッシュする
      const res = await fetch('./index.html', { cache: 'reload' });
      const html = await res.clone().text();
      const urls = new Set(['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png']);
      for (const m of html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)) urls.add(m[1]);
      await core.addAll([...urls]);
      // 大きいファイルは失敗しても本体のインストールは続ける
      const stat = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        STATIC_URLS.map(async (u) => {
          if (!(await stat.match(u))) await stat.add(u);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('chess-dojo-core-') && k !== CORE_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移: ネットワーク優先(更新を反映)、オフラインならキャッシュ
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('./index.html', { ignoreVary: true })) || (await caches.match('./', { ignoreVary: true })) || Response.error()),
    );
    return;
  }

  // エンジン/パズルデータ/アプリの assets: キャッシュ優先
  event.respondWith(
    (async () => {
      // Vary: Origin などで、インストール時に保存した応答と一致しないことがあるため ignoreVary を指定
      const cached = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          const isStatic = url.pathname.includes('/stockfish/') || url.pathname.includes('/puzzles/');
          const cache = await caches.open(isStatic ? STATIC_CACHE : CORE_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return Response.error();
      }
    })(),
  );
});
