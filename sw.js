// =====================================================
// 🔔 SERVICE WORKER — VILLA PARAÍSO GUARDALAVACA
// Recibe notificaciones push y las muestra al mesero
// =====================================================

const CACHE_NAME = 'villa-paraiso-v2';
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
      // addAll falla si algún recurso no existe, por eso usamos try por cada uno
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
      // Si ya hay una ventana del mesero abierta, la enfocamos
      for (const client of clientList) {
        if (client.url.includes('/mesero') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrimos una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============ AL HACER CLIC EN UNA NOTIFICACIÓN CERRADA ============
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notificación cerrada sin acción');
});

// ============ FETCH (opcional: cache-first para assets) ============
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET
  if (event.request.method !== 'GET') return;

  // No interceptamos las peticiones a Supabase (necesitan siempre red)
  if (event.request.url.includes('supabase.co')) return;

  // Estrategia: network-first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Guardamos una copia en cache si es un recurso propio
        if (response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red, buscamos en cache
        return caches.match(event.request);
      })
  );
});