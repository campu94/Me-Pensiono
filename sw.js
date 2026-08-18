const CACHE = 'finanzas-shell-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Red primero: cualquier cambio publicado se ve de inmediato la próxima
// vez que haya internet (que es siempre, para esta app). El caché solo
// se usa como respaldo si en algún momento no hay conexión.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // deja pasar las llamadas al Apps Script
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
