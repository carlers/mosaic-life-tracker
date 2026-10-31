import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  cache: vi.fn(),
  pending: vi.fn(),
}));
vi.mock('../../src/lib/imageCache', () => ({ getImageCacheUsage: storageMocks.cache }));
vi.mock('../../src/lib/pendingImages', () => ({ getPendingImageUsageForUser: storageMocks.pending }));
import { readDeviceStorageUsage } from '../../src/lib/deviceStorageUsage';

beforeEach(() => {
  storageMocks.cache.mockReset().mockResolvedValue({ bytes: 120, count: 2 });
  storageMocks.pending.mockReset().mockResolvedValue({ bytes: 36, count: 1 });
  vi.stubGlobal('navigator', {
    storage: {
      estimate: vi.fn().mockResolvedValue({ usage: 400, quota: 1000 }),
      persisted: vi.fn().mockResolvedValue(false),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('on-demand device storage reporting', () => {
  it('reports browser estimates separately from device-wide cached media and owner uploads', async () => {
    const report = await readDeviceStorageUsage('owner_a');
    expect(report).toEqual({
      ownerId: 'owner_a',
      origin: { usedBytes: 400, quotaBytes: 1000 },
      persistent: false,
      downloadedImages: { bytes: 120, count: 2 },
      pendingImages: { bytes: 36, count: 1 },
    });
    expect(storageMocks.pending).toHaveBeenCalledExactlyOnceWith('owner_a');
  });

  it('degrades each unavailable source independently and rejects invalid estimates', async () => {
    vi.stubGlobal('navigator', { storage: {
      estimate: vi.fn().mockResolvedValue({ usage: -1, quota: Infinity }),
      persisted: vi.fn().mockRejectedValue(new Error('denied')),
    } });
    storageMocks.pending.mockRejectedValue(new Error('IDB closed'));
    const report = await readDeviceStorageUsage('owner_b');
    expect(report.origin).toEqual({ usedBytes: null, quotaBytes: null });
    expect(report.persistent).toBeNull();
    expect(report.pendingImages).toBeNull();
    expect(report.downloadedImages).toEqual({ bytes: 120, count: 2 });
    expect(storageMocks.pending).toHaveBeenCalledWith('owner_b');
  });

  it('does not fail when storage APIs do not exist', async () => {
    vi.stubGlobal('navigator', {});
    const report = await readDeviceStorageUsage('owner_c');
    expect(report.origin).toBeNull();
    expect(report.persistent).toBeNull();
    expect(report.downloadedImages?.bytes).toBe(120);
  });

  it('refuses an unknown owner rather than reading another account pending files', async () => {
    await expect(readDeviceStorageUsage('')).rejects.toThrow('authenticated owner');
    expect(storageMocks.pending).not.toHaveBeenCalled();
  });
});
