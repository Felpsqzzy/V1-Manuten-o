const CACHE = 'biotrop-enhancements-v3';
const ASSETS = [
  '/assets/css/biotrop-enhancements.css',
  '/assets/js/biotrop-enhancements.js',
  '/assets/js/biotrop-business-rules.js',
  '/assets/js/scm-approval-fix.js'
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(() => {})));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.endsWith('/app.html')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        const type = response.headers.get('content-type') || '';
        if (!type.includes('text/html')) return response;
        const html = await response.text();
        const inject = `\n<link rel="stylesheet" href="/assets/css/biotrop-enhancements.css?v=3">\n<script src="/assets/js/biotrop-enhancements.js?v=3" defer></script>\n<script src="/assets/js/biotrop-business-rules.js?v=3" defer></script>\n<script src="/assets/js/scm-approval-fix.js?v=3" defer></script>\n`;
        const output = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, inject + '</head>') : inject + html;
        return new Response(output, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
      } catch (err) {
        return caches.match(event.request);
      }
    })());
    return;
  }
  if (ASSETS.some(path => url.pathname === path)) {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
  }
});
