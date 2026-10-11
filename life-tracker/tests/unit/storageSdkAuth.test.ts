import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardedStorage } from '../../src/lib/sdk';
import { client } from '../../src/lib/appwrite';

const fallbackCookies = JSON.stringify({
  [`a_session_${client.config.project}`]: 'device-local-session',
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Appwrite-authenticated photo downloads', () => {
  function mockBrowser() {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => key === 'cookieFallback' ? fallbackCookies : null,
      },
      dispatchEvent,
    });
    return dispatchEvent;
  }

  it('includes SDK localStorage session fallback and credentials for cross-device files', async () => {
    mockBrowser();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['photo'], { type: 'image/webp' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const blob = await guardedStorage.downloadFileBlob({
      bucketId: 'task_images', fileId: 'img_uploaded_on_laptop',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe('photo');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('img_uploaded_on_laptop');
    expect(options.credentials).toBe('include');
    expect(options.headers).toEqual(expect.objectContaining({
      'X-Appwrite-Project': client.config.project,
      'X-Fallback-Cookies': fallbackCookies,
    }));
  });

  it.each([206, 403, 404])('rejects HTTP %i without returning a partial or inaccessible blob', async (status) => {
    mockBrowser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('failure', { status })));
    await expect(guardedStorage.downloadFileBlob({
      bucketId: 'task_images', fileId: 'img_missing',
    })).rejects.toMatchObject({ code: status });
  });

  it('distinguishes an expired session (HTTP 401) from offline failure', async () => {
    mockBrowser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('expired', { status: 401 })));
    await expect(guardedStorage.downloadFileBlob({
      bucketId: 'task_images', fileId: 'img_session',
    })).rejects.toMatchObject({ code: 401 });
  });
});
