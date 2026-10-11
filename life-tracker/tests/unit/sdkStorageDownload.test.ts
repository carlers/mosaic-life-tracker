import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardedStorage } from '../../src/lib/sdk';

// Use the real Appwrite 26.2 request preparation, rather than a fake
// handwritten credentials header: a valid Safari/PWA session can be held
// in the SDK's fallback cookie store instead of a third-party cookie.
describe('authenticated Appwrite image download', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the Appwrite fallback session header and browser credentials', async () => {
    const fallback = JSON.stringify({ a_session_test: 'private-session' });
    vi.stubGlobal('window', {
      localStorage: { getItem: (key: string) => key === 'cookieFallback' ? fallback : null },
      dispatchEvent: vi.fn(),
    });
    const bytes = new Blob(['png-image'], { type: 'image/png' });
    const remoteFetch = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
    vi.stubGlobal('fetch', remoteFetch);

    const received = await guardedStorage.getFileBlob({
      bucketId: 'task_images',
      fileId: 'img_other_device',
    });

    expect(received).toBeInstanceOf(Blob);
    expect(received.type).toBe('image/png');
    expect(await received.text()).toBe('png-image');
    const [url, options] = remoteFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/storage/buckets/task_images/files/img_other_device/view');
    expect(options.credentials).toBe('include');
    expect((options.headers as Record<string, string>)['X-Fallback-Cookies']).toBe(fallback);
    expect((options.headers as Record<string, string>)['X-Appwrite-Project']).toBeTruthy();
  });

  it.each([206, 403, 404])('rejects HTTP %s instead of caching an invalid response', async (status) => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null }, dispatchEvent: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad-photo', { status })));

    await expect(guardedStorage.getFileBlob({
      bucketId: 'task_images',
      fileId: 'img_broken',
    })).rejects.toMatchObject({ code: status });
  });

  it('rejects an empty successful response', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null }, dispatchEvent: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));

    await expect(guardedStorage.getFileBlob({
      bucketId: 'task_images',
      fileId: 'img_empty',
    })).rejects.toThrow(/empty/i);
  });
});
