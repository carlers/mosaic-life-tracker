import { describe, it, expect, beforeEach, vi } from 'vitest';

const sdkRef = vi.hoisted(() => ({
  guardedAccountGet: vi.fn(),
  guardedStorageCreateFile: vi.fn(),
  guardedStorageDeleteFile: vi.fn(),
  guardedStorageGetFile: vi.fn(),
  guardedStorageGetFileView: vi.fn(),
  guardedStorageGetFilePreview: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: { get: sdkRef.guardedAccountGet },
  guardedStorage: {
    createFile: sdkRef.guardedStorageCreateFile,
    deleteFile: sdkRef.guardedStorageDeleteFile,
    getFile: sdkRef.guardedStorageGetFile,
    getFileView: sdkRef.guardedStorageGetFileView,
    getFilePreview: sdkRef.guardedStorageGetFilePreview,
  },
  guardedTablesDB: {},
  guardedFunctions: {},
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

import {
  uploadImage,
  getCurrentUserId,
  ensureRestoredImage,
} from '../../src/lib/storage';
import { isOfflineError } from '../../src/lib/authEvents';

function makeFile(): File {
  return new File(['abc'], 'a.png', { type: 'image/png' });
}

beforeEach(() => {
  sdkRef.guardedAccountGet.mockReset();
  sdkRef.guardedStorageCreateFile.mockReset();
  sdkRef.guardedStorageGetFile.mockReset();
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
});
