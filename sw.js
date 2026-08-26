/* 霓潮倖存 NEON SURGE — Service Worker
   策略：HTML 文件走「網路優先且繞過瀏覽器 HTTP 快取(no-store)」，確保每次上線都拿到最新版；
        離線時退回快取；圖示等同源資源走「快取優先」；全部離線可玩。*/
var CACHE = 'neon-surge-v2';
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 收到頁面的 skipWaiting 指令即立刻接管，讓新版無需關 App 就生效
self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var isDoc = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isDoc) {
    // 網路優先 + no-store：永遠繞過 HTTP 快取抓最新 index.html，失敗(離線)才退回快取
    e.respondWith(
      fetch('./index.html', { cache: 'no-store' }).then(function (res) {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', clone); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) { return hit || caches.match(req); });
      })
    );
    return;
  }

  // 其他同源資源：快取優先
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        try {
          var u = new URL(req.url);
          if (u.origin === location.origin) {
            var clone = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, clone); });
          }
        } catch (_) {}
        return res;
      });
    })
  );
});
