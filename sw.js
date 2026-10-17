// Service worker (S8): precachea solo la lista versionada del "shell" de la
// app. Caché primero. Solo responde a peticiones GET del mismo origen.
// Nunca guarda en caché nada que no esté en SHELL_FILES. Sin sync ni push.
import { CACHE_VERSION, SHELL_FILES } from './js/shell-manifest.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(SHELL_FILES);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      let cached = await cache.match(req);
      if (!cached && req.mode === 'navigate') {
        // Navegación a una ruta sin archivo propio (p.ej. "/" o una ruta de la
        // SPA): el shell es siempre index.html, que ya está precacheado.
        cached = await cache.match('./index.html');
      }
      if (cached) return cached;
      try {
        return await fetch(req);
      } catch {
        return Response.error();
      }
    })()
  );
});
