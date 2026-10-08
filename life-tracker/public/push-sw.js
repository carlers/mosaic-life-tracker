const PUSH_STATE_DB = 'mosaic_push_state';
const PUSH_STATE_STORE = 'meta';
const ACTIVE_USER_KEY = 'active-user';
const FOREGROUND_PUSH_KEY = 'push-while-open';

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

// A missing preference retains today's behavior (show notifications).
function readPushWhileOpen() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(PUSH_STATE_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(PUSH_STATE_STORE)) {
          request.result.createObjectStore(PUSH_STATE_STORE);
        }
      };
      request.onerror = () => resolve(true);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(PUSH_STATE_STORE, 'readonly');
        const get = tx.objectStore(PUSH_STATE_STORE).get(FOREGROUND_PUSH_KEY);
        get.onerror = () => resolve(true);
        get.onsuccess = () => resolve(get.result !== false);
      };
    } catch {
      resolve(true);
    }
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
      // Chromium permits skipping a system push when this origin is visibly
      // foregrounded. WebKit requires showNotification for every push or may
      // revoke permission; never suppress delivery on Safari/iOS.
      const agent = self.navigator?.userAgent || '';
      const chromium = /Chrome|Chromium|Edg|SamsungBrowser/i.test(agent) &&
        !/iPhone|iPad|iPod/i.test(agent);
      if (chromium && !(await readPushWhileOpen())) {
        try {
          const windows = await self.clients.matchAll({
            type: 'window', includeUncontrolled: true,
          });
          const isVisible = windows.some((client) => {
            try {
              return client.visibilityState === 'visible' &&
                new URL(client.url).origin === self.location.origin;
            } catch {
              return false;
            }
          });
          if (isVisible) return;
        } catch {
          // Unknown window state: keep the push rather than silently lose it.
        }
      }

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
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    const activeUser = await readActiveUser();
    // Always open the app. A previous account's alert must never deep-link
    // into its data, but a missing marker must not turn taps into no-ops.
    const isCurrent = Boolean(activeUser) && data.userId === activeUser;
    const deepLink = isCurrent && typeof data.url === 'string' &&
      /^\/notifications\?alert=not_[a-f0-9]{32}$/.test(data.url)
      ? data.url : '/notifications';
    const targetUrl = new URL(deepLink, self.location.origin).href;
    const windows = await self.clients.matchAll({
      type: 'window', includeUncontrolled: true,
    });
    const sameOrigin = windows.filter((client) => {
      try { return new URL(client.url).origin === self.location.origin; }
      catch { return false; }
    });
    const preferred = sameOrigin.find((client) =>
      new URL(client.url).pathname === '/notifications'
    ) || sameOrigin[0];
    if (preferred) {
      try {
        const navigated = await preferred.navigate(targetUrl);
        if (navigated) {
          await navigated.focus();
          return;
        }
      } catch {
        // Some installed-PWA clients reject navigate(). openWindow is
        // the fallback and can reuse the installed application on Android.
      }
    }
    try {
      const opened = await self.clients.openWindow(targetUrl);
      if (opened) await opened.focus();
    } catch {
      // The platform can refuse to open a window (OS/browser restrictions).
    }
  })());
});
