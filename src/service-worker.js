import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST);

function createApiStrategy(cacheName) {
  return new StaleWhileRevalidate({ cacheName });
}

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.pathname.startsWith('/api/businesses') &&
    !url.pathname.includes('/favorites'),
  createApiStrategy('fasty-api-businesses'),
);

registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.includes('/menu'),
  createApiStrategy('fasty-api-menu'),
);

registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/banners/active'),
  createApiStrategy('fasty-api-banners'),
);

registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/promotions'),
  createApiStrategy('fasty-api-promotions'),
);

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname.endsWith('/theme-color') || url.pathname.endsWith('/maintenance')),
  new NetworkFirst({
    cacheName: 'fasty-api-config',
    networkTimeoutSeconds: 3,
  }),
);

self.addEventListener('push', (event) => {
  let data = { title: 'Fasty', body: 'Nueva notificacion', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/favicon.ico',
    vibrate: [500, 200, 500, 200, 500, 200, 1000],
    requireInteraction: data.type === 'admin_alert' || (data.title && (data.title.includes('SOS') || data.title.includes('🚨'))),
    silent: false,
    tag: data.type === 'admin_alert'
      ? 'admin-alert'
      : data.title.includes('Pedido') ? 'nuevo-pedido' : 'notificacion-general',
    renotify: true,
    data: {
      url: data.url || '/',
      type: data.type || 'general',
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      const targetUrl = new URL(url, self.location.origin).href;

      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then((navigatedClient) => (
              navigatedClient ? navigatedClient.focus() : client.focus()
            ));
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
