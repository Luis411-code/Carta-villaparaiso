// =====================================================
// 🔔 SERVICE WORKER — VILLA PARAÍSO GUARDALAVACA
// Estrategia: network-first para HTML/CSS/JS, cache-first para imágenes
// =====================================================

const CACHE_NAME = 'villa-paraiso-v4'; // ⬆️ Bump de versión al actualizar
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/mesero.html',
  '/mesero.css',
  '/mesero.js',
  '/img/logo.png'
];

// ============ INSTALACIÓN ============
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        URLS_TO_CACHE.map(url =>
          cache.add(url).catch(() => {
            console.warn(`⚠️ No se pudo cachear: ${url}`);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ============ ACTIVACIÓN ============
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activo');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ============ MENSAJE DEL CLIENTE ============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============ RECIBIR NOTIFICACIÓN PUSH ============
self.addEventListener('push', (event) => {
  console.log('🔔 Push recibido');

  let data = {
    title: '🍽️ Nuevo pedido',
    body: 'Toca para ver el detalle',
    icon: '/img/logo.png',
    badge: '/img/logo.png',
    data: { url: '/mesero' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [300, 150, 300, 150, 300],
    tag: 'nuevo-pedido',
    renotify: true,
    requireInteraction: true,
    data: data.data,
    actions: [
      { action: 'ver', title: '👁️ Ver pedido' },
      { action: 'cerrar', title: '✕ Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============ AL TOCAR LA NOTIFICACIÓN ============
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'cerrar') return;

  const urlToOpen = event.notification.data?.url || '/mesero';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/mesero') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============ FETCH — network-first para HTML/JS/CSS ============
self.addEventListener('fetch', (event) => {
  // Solo GET
  if (event.request.method !== 'GET') return;

  // No interceptar Supabase ni otras APIs externas
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Archivos críticos: SIEMPRE red primero (sin caché)
  const esArchivoCritico =
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/' ||
    url.pathname === '/admin' ||
    url.pathname === '/mesero';

  if (esArchivoCritico) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Imágenes y otros assets: cache-first (más rápido)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});