import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// The script executes inside a service worker; exercise click routing without
// spinning up a second browser or depending on Android-specific mocks.
function harness(activeUser: string | null, navigateRejects = false) {
  const handlers: Record<string, (event: any) => void> = {};
  const existing = {
    url: 'https://mosaic.example/home',
    navigate: vi.fn(async (_url: string) => {
      if (navigateRejects) throw new Error('Installed-window navigate unavailable');
      return existing;
    }),
    focus: vi.fn(async () => existing),
  };
  const opened = {
    url: 'https://mosaic.example/notifications',
    focus: vi.fn(async () => opened),
  };
  const clients = {
    matchAll: vi.fn(async () => [existing]),
    openWindow: vi.fn(async () => opened),
  };
  const indexedDB = {
    open() {
      const request: any = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              get: () => {
                const result: any = { result: activeUser };
                queueMicrotask(() => result.onsuccess?.());
                return result;
              },
            }),
          }),
        },
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  const self = {
    location: { origin: 'https://mosaic.example' },
    clients,
    addEventListener: (event: string, handler: (event: any) => void) => {
      handlers[event] = handler;
    },
  };
  runInNewContext(
    readFileSync('public/push-sw.js', 'utf8'),
    { self, indexedDB, URL, console, Promise }
  );
  const click = async (userId: string, url: string) => {
    let completed: Promise<unknown> | undefined;
    handlers.notificationclick({
      notification: { data: { userId, url }, close: vi.fn() },
      waitUntil: (promise: Promise<unknown>) => { completed = promise; },
    });
    await completed;
  };
  return { click, existing, opened, clients };
}

describe('push notification click routing', () => {
  const alert = 'not_' + 'a'.repeat(32);
  it('opens the specific notification in an existing app window', async () => {
    const h = harness('user_a');
    await h.click('user_a', '/notifications?alert=' + alert);
    expect(h.existing.navigate).toHaveBeenCalledWith(
      'https://mosaic.example/notifications?alert=' + alert
    );
    expect(h.existing.focus).toHaveBeenCalledTimes(1);
    expect(h.clients.openWindow).not.toHaveBeenCalled();
  });

  it('falls back to opening a window when installed-PWA navigation fails', async () => {
    const h = harness('user_a', true);
    await h.click('user_a', '/notifications?alert=' + alert);
    expect(h.clients.openWindow).toHaveBeenCalledWith(
      'https://mosaic.example/notifications?alert=' + alert
    );
    expect(h.opened.focus).toHaveBeenCalledTimes(1);
  });

  it('never follows another account or external notification destination', async () => {
    const h = harness('user_b');
    await h.click('user_a', '/notifications?alert=' + alert);
    expect(h.existing.navigate).toHaveBeenCalledWith(
      'https://mosaic.example/notifications'
    );
    await h.click('user_b', 'https://evil.example/steal');
    expect(h.existing.navigate).toHaveBeenLastCalledWith(
      'https://mosaic.example/notifications'
    );
  });

  it('opens generic Alerts even when the active-account marker is missing', async () => {
    const h = harness(null);
    await h.click('user_a', '/notifications?alert=' + alert);
    expect(h.existing.navigate).toHaveBeenCalledWith(
      'https://mosaic.example/notifications'
    );
  });
});
