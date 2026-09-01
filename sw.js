/* =====================================================================
 * 健身动作库 · Service Worker（离线缓存核心）
 * 策略：
 *   - 文档 / 导航请求 → 网络优先（在线时永远拿最新，离线回退缓存）
 *   - 其它同源 GET   → 缓存优先（快），离线也能用
 * ---------------------------------------------------------------------
 * 说明：本页所有动作 GIF 已用 base64 data URI 内嵌在 HTML 里，
 *       fitness.xingshuwen.com 只是「动作百科页面」的外链（锚点），并非图片，
 *       因此离线打开时动作图/示意/训练计划全部可用，无需图片外链缓存。
 * ---------------------------------------------------------------------
 * ⚠️ 每次修改 index.html 或这里的资源，都要把 CACHE_NAME 的数字 +1
 *    （v2 → v3 → …），否则已安装的用户会命中旧缓存。
 * ===================================================================== */

const CACHE_NAME = 'gym-handbook-v2';

// 首次安装时预缓存的核心资源（均为同源、自包含）
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ---------- 安装：预缓存核心资源 ---------- */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

/* ---------- 激活：清理旧版本缓存 ---------- */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- 拦截请求 ---------- */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  // ① 文档 / 导航：网络优先 → 在线更新即时，离线回退缓存
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // ② 其它同源 GET：缓存优先，未命中走网络并回填
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
