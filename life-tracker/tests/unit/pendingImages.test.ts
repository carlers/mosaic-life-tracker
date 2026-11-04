import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPendingImage, resetPendingImagesForTests } from '../../src/lib/pendingImages';

function installControllableIndexedDB() {
  const put = vi.fn(() => ({}));
  const tx = {
    oncomplete: null as null | (() => void),
    onerror: null as null | (() => void),
    onabort: null as null | (() => void),
    error: null as Error | null,
    objectStore: () => ({ put }),
  };
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: () => tx,
    close: vi.fn(),
    onversionchange: null as null | (() => void),
  };
  const request = {
    result: db,
    onupgradeneeded: null as null | (() => void),
    onsuccess: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  vi.stubGlobal('indexedDB', { open: () => {
    queueMicrotask(() => request.onsuccess?.());
    return request;
  } });
  return { tx, put };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetPendingImagesForTests();
});

describe('durable pending photo staging', () => {
  it('waits for the transaction commit before returning a photo ID', async () => {
    const { tx, put } = installControllableIndexedDB();
    let settled = false;
    const saving = createPendingImage('owner_a', new Blob(['photo'])).then(id => {
      settled = true;
      return id;
    });
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(settled).toBe(false);
    tx.oncomplete?.();
    await expect(saving).resolves.toMatch(/^localimg_[0-9a-f]{26}$/);
  });

  it('rejects a transaction abort instead of exposing uncommitted media', async () => {
    const { tx, put } = installControllableIndexedDB();
    const saving = createPendingImage('owner_a', new Blob(['photo']));
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    tx.error = new Error('QuotaExceededError');
    tx.onabort?.();
    await expect(saving).rejects.toThrow('QuotaExceededError');
  });
});
