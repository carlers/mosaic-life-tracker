import { describe, it, expect, beforeEach, vi } from 'vitest';

const pendingRef = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));
const imageCacheRef = vi.hoisted(() => ({
  get: vi.fn(),
  cache: vi.fn(),
  remove: vi.fn(),
}));

const sdkRef = vi.hoisted(() => ({
  guardedAccountGet: vi.fn(),
  guardedStorageCreateFile: vi.fn(),
  guardedStorageDeleteFile: vi.fn(),
  guardedStorageGetFile: vi.fn(),
  guardedStorageGetFileView: vi.fn(),
  guardedStorageGetFilePreview: vi.fn(),
  guardedStorageUpdateFile: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: { get: sdkRef.guardedAccountGet },
  guardedStorage: {
    createFile: sdkRef.guardedStorageCreateFile,
    deleteFile: sdkRef.guardedStorageDeleteFile,
    getFile: sdkRef.guardedStorageGetFile,
    getFileView: sdkRef.guardedStorageGetFileView,
    getFilePreview: sdkRef.guardedStorageGetFilePreview,
    updateFile: sdkRef.guardedStorageUpdateFile,
  },
  guardedTablesDB: {},
  guardedFunctions: {},
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));
vi.mock('../../src/lib/pendingImages', () => ({
  createPendingImage: pendingRef.create,
  getPendingImage: pendingRef.get,
  deletePendingImage: pendingRef.remove,
  isPendingImageId: (fileId: string) => fileId.startsWith('localimg_'),
}));
vi.mock('../../src/lib/imageCache', () => ({
  getCachedImage: imageCacheRef.get,
  cacheImage: imageCacheRef.cache,
  deleteCachedImage: imageCacheRef.remove,
}));

import {
  uploadImage,
  getCurrentUserId,
  ensureRestoredImage,
  saveImage,
  saveProfileImage,
  makeProfileImageReadable,
  uploadPendingImage,
  deleteImage,
} from '../../src/lib/storage';
import { isOfflineError } from '../../src/lib/authEvents';
import { markConnectivityOnline, markConnectivityOffline } from '../../src/lib/connectivity';

function makeFile(): File {
  return new File(['abc'], 'a.png', { type: 'image/png' });
}

beforeEach(() => {
  sdkRef.guardedAccountGet.mockReset();
  sdkRef.guardedStorageCreateFile.mockReset();
  sdkRef.guardedStorageGetFile.mockReset();
  sdkRef.guardedStorageUpdateFile.mockReset();
  sdkRef.guardedStorageDeleteFile.mockReset();
  pendingRef.create.mockReset();
  pendingRef.get.mockReset();
  pendingRef.remove.mockReset();
  imageCacheRef.get.mockReset();
  imageCacheRef.cache.mockReset().mockResolvedValue(undefined);
  imageCacheRef.remove.mockReset();
});

// Regression: §23.6 (confirmed 401 differs from network/offline uncertainty).
describe('storage.getCurrentUserId — 401 vs network', () => {
  it('returns null when the server returns 401', async () => {
    sdkRef.guardedAccountGet.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { code: 401 })
    );
    await expect(getCurrentUserId()).resolves.toBeNull();
  });

  it('throws OfflineError on a network failure (no code)', async () => {
    sdkRef.guardedAccountGet.mockRejectedValueOnce(new Error('Network down'));
    let caught: unknown = null;
    try {
      await getCurrentUserId();
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(isOfflineError(caught)).toBe(true);
  });
});

describe('storage.uploadImage — error messages', () => {
  it('throws "no authenticated user" when the server returns 401', async () => {
    sdkRef.guardedAccountGet.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { code: 401 })
    );
    await expect(uploadImage(makeFile())).rejects.toThrow(
      /no authenticated user/
    );
  });

  it('throws a distinguishable Offline error on a network failure', async () => {
    sdkRef.guardedAccountGet.mockRejectedValueOnce(new Error('Network down'));
    let caught: unknown = null;
    try {
      await uploadImage(makeFile());
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(isOfflineError(caught)).toBe(true);
    // The misleading "no authenticated user" message MUST NOT leak here.
    expect((caught as Error).message).not.toMatch(/no authenticated user/);
  });

  it('uploads successfully when the session exists', async () => {
    sdkRef.guardedAccountGet.mockResolvedValueOnce({ $id: 'user_A' });
    sdkRef.guardedStorageCreateFile.mockResolvedValueOnce({ $id: 'img_1' });
    const id = await uploadImage(makeFile());
    expect(typeof id).toBe('string');
    expect(id.startsWith('img_')).toBe(true);
    expect(sdkRef.guardedStorageCreateFile).toHaveBeenCalledTimes(1);
  });
});


describe('storage.saveProfileImage — friend-readable permissions', () => {
  it('uploads profile images with all-user read access and owner-only writes', async () => {
    markConnectivityOnline('test');
    sdkRef.guardedStorageCreateFile.mockResolvedValueOnce({ $id: 'img_profile' });
    await expect(saveProfileImage(makeFile(), 'user_A')).resolves.toMatch(/^img_/);
    expect(sdkRef.guardedStorageCreateFile).toHaveBeenCalledWith(expect.objectContaining({
      permissions: ['read("users")', 'update("user:user_A")', 'delete("user:user_A")'],
    }));
    markConnectivityOffline('test-reset');
  });

  it('repairs an existing profile image without broadening writes', async () => {
    await makeProfileImageReadable('img_profile', 'user_A');
    expect(sdkRef.guardedStorageUpdateFile).toHaveBeenCalledWith({
      bucketId: expect.any(String),
      fileId: 'img_profile',
      permissions: ['read("users")', 'update("user:user_A")', 'delete("user:user_A")'],
    });
  });
});

describe('storage.ensureRestoredImage — idempotent backup recovery', () => {
  it('reuses an existing preferred file instead of uploading a duplicate', async () => {
    sdkRef.guardedAccountGet.mockResolvedValueOnce({ $id: 'user_A' });
    sdkRef.guardedStorageGetFile.mockResolvedValueOnce({ $id: 'bk_i_existing' });

    await expect(
      ensureRestoredImage(makeFile(), 'bk_i_existing')
    ).resolves.toEqual({ fileId: 'bk_i_existing', uploaded: false });

    expect(sdkRef.guardedStorageCreateFile).not.toHaveBeenCalled();
  });

  it('creates a missing preferred file with the deterministic ID', async () => {
    sdkRef.guardedAccountGet.mockResolvedValueOnce({ $id: 'user_A' });
    sdkRef.guardedStorageGetFile.mockRejectedValueOnce(
      Object.assign(new Error('Not found'), { code: 404 })
    );
    sdkRef.guardedStorageCreateFile.mockResolvedValueOnce({ $id: 'bk_i_restored' });

    await expect(
      ensureRestoredImage(makeFile(), 'bk_i_restored')
    ).resolves.toEqual({ fileId: 'bk_i_restored', uploaded: true });

    expect(sdkRef.guardedStorageCreateFile).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'bk_i_restored' })
    );
  });

  it('treats a create conflict as successful reuse after a race', async () => {
    sdkRef.guardedAccountGet.mockResolvedValueOnce({ $id: 'user_A' });
    sdkRef.guardedStorageGetFile.mockRejectedValueOnce(
      Object.assign(new Error('Not found'), { code: 404 })
    );
    sdkRef.guardedStorageCreateFile.mockRejectedValueOnce(
      Object.assign(new Error('Already exists'), { code: 409 })
    );

    await expect(
      ensureRestoredImage(makeFile(), 'bk_i_race')
    ).resolves.toEqual({ fileId: 'bk_i_race', uploaded: false });
  });


  it('refuses restore-image writes if the authenticated account changed', async () => {
    sdkRef.guardedAccountGet.mockResolvedValueOnce({ $id: 'user_B' });

    await expect(
      ensureRestoredImage(makeFile(), 'bk_i_account_guard', 'user_A')
    ).rejects.toThrow(/authenticated user changed/i);

    expect(sdkRef.guardedStorageGetFile).not.toHaveBeenCalled();
    expect(sdkRef.guardedStorageCreateFile).not.toHaveBeenCalled();
  });
});


describe('storage.saveImage — offline staging', () => {
  it('stages a compressed image locally when definitely offline', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    });
    pendingRef.create.mockResolvedValueOnce(
      'localimg_0123456789abcdef0123456789'
    );

    await expect(saveImage(makeFile(), 'user_A')).resolves.toBe(
      'localimg_0123456789abcdef0123456789'
    );

    expect(pendingRef.create).toHaveBeenCalledWith(
      'user_A',
      expect.any(Blob)
    );
    expect(sdkRef.guardedAccountGet).not.toHaveBeenCalled();
    expect(sdkRef.guardedStorageCreateFile).not.toHaveBeenCalled();
  });

  it('falls back to local staging when the browser reports online but upload has a transient network failure', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    });
    sdkRef.guardedStorageCreateFile.mockRejectedValueOnce(
      new Error('Network down')
    );
    pendingRef.create.mockResolvedValueOnce(
      'localimg_abcdef0123456789abcdef0123'
    );

    await expect(saveImage(makeFile(), 'user_A')).resolves.toBe(
      'localimg_abcdef0123456789abcdef0123'
    );
    expect(pendingRef.create).toHaveBeenCalledOnce();
  });

  it('uses a deterministic remote id when reconciling a pending image', async () => {
    pendingRef.get.mockResolvedValueOnce(
      new Blob(['photo'], { type: 'image/webp' })
    );
    sdkRef.guardedStorageCreateFile.mockResolvedValueOnce({});

    const remoteId = await uploadPendingImage(
      'localimg_0123456789abcdef0123456789',
      'user_A'
    );

    expect(remoteId).toBe('img_0123456789abcdef0123456789');
    expect(sdkRef.guardedStorageCreateFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'img_0123456789abcdef0123456789',
      })
    );
  });

  it('deletes a pending image locally without issuing a Storage delete', async () => {
    await deleteImage('localimg_0123456789abcdef0123456789');

    expect(pendingRef.remove).toHaveBeenCalledWith(
      'localimg_0123456789abcdef0123456789'
    );
    expect(sdkRef.guardedStorageDeleteFile).not.toHaveBeenCalled();
  });
});
