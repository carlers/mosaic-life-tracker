const PUSH_STATE_DB = 'mosaic_push_state';
const PUSH_STATE_STORE = 'meta';
const ACTIVE_USER_KEY = 'active-user';

function readActiveUser() {
  return new Promise((resolve) => {
    const request = indexedDB.open(PUSH_STATE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PUSH_STATE_STORE)) {
        request.result.createObjectStore(PUSH_STATE_STORE);
      }
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(PUSH_STATE_STORE, 'readonly');
      const get = tx.objectStore(PUSH_STATE_STORE).get(ACTIVE_USER_KEY);
      get.onerror = () => resolve(null);
      get.onsuccess = () =>
        resolve(typeof get.result === 'string' ? get.result : null);
    };
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data ? event.data.json() : null;
      } catch {
        return;
      }
      if (!payload || typeof payload.userId !== 'string') return;
      const activeUser = await readActiveUser();
      if (!activeUser || activeUser !== payload.userId) return;

      await self.registration.showNotification(
        typeof payload.title === 'string' ? payload.title : 'Mosaic',
        {
          body:
            typeof payload.body === 'string'
              ? payload.body
              : 'You have new activity.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag:
            typeof payload.tag === 'string'
              ? payload.tag
              : 'mosaic-activity',
          data: {
            userId: payload.userId,
            url:
              typeof payload.url === 'string'
                ? payload.url
                : '/notifications',
          },
        }
      );
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const data = event.notification.data || {};
      const activeUser = await readActiveUser();
      if (!activeUser || data.userId !== activeUser) return;

      const targetUrl = new URL(
        typeof data.url === 'string' ? data.url : '/notifications',
        self.location.origin
      ).href;
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ('navigate' in client) {
          await client.navigate(targetUrl);
        }
        await client.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
