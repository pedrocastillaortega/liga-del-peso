// La Liga del Peso - Service Worker
const CACHE_NAME = 'liga-del-peso-v1';

// Recursos estáticos a cachear para uso offline
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/manifest.json',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/offline'
];

// Instalar: precachear recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Continuar aunque algún recurso falle
      });
    })
  );
  self.skipWaiting();
});

// Activar: limpiar caches antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: red primero, cache como respaldo, offline como último recurso
self.addEventListener('fetch', event => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // No cachear peticiones de subida de archivos
  if (event.request.url.includes('/upload') || event.request.url.includes('/submit')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, guardar en cache
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin conexión: intentar desde cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Si no hay cache, mostrar página offline
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline');
          }
        });
      })
  );
});
