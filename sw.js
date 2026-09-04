// Service Worker：讓「App 外殼」（HTML/CSS/JS）離線也能打開。
//
// 不快取 FinMind 等資料 API——那些的「離線也能看」已經由 src/cache.js 的
// IndexedDB 快取處理了；這裡只負責靜態檔案 + 外部 CDN 函式庫。
//
// 策略：
//   同源靜態檔  → network-first：有網路一定拿最新版，只有離線才退回快取。
//               （這個專案還在頻繁改版，cache-first 會讓使用者卡在舊版一直除錯
//               不出來——改壞過一次才學到，見 AGENTS.md）
//   外部 CDN    → cache-first（版本有 pin 在網址裡，抓過一次可以放心一直用）
//   其他（API） → 不攔截，交給網路，失敗就讓呼叫端自己處理

const VERSION = 'v2';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './src/app.js',
  './src/api.js',
  './src/cache.js',
  './src/deduction.js',
  './src/chips.js',
  './src/chart.js',
  './src/scan.js',
  './src/mascot.js',
  './src/style.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 同源：app 外殼檔案。network-first——有網路就一定是最新版，
  // fetch 失敗（離線）才退回快取。
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 外部 CDN（圖表庫 / idb-keyval），網址本身已 pin 版本，快取安全
  if (url.hostname.endsWith('jsdelivr.net')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res.ok) caches.open(RUNTIME_CACHE).then((c) => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // 其餘（FinMind 等資料 API）：不攔截
});
