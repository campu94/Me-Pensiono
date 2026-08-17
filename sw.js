const CACHE = 'finanzas-shell-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.json'];

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

// Solo cachea el "shell" de la app (HTML/CSS/JS). Los datos financieros
// siempre se piden en vivo al backend, nunca desde caché.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // deja pasar las llamadas al Apps Script
  if (url.pathname.endsWith('config.js')) return; // siempre en vivo: es el archivo que editas a mano
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
