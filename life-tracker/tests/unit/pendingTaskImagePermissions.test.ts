import { describe, expect, it, vi } from 'vitest';

const refs = vi.hoisted(() => ({
  getPendingImage: vi.fn(),
  createFile: vi.fn(),
  updateFile: vi.fn(),
}));

vi.mock('../../src/lib/pendingImages', () => ({
  getPendingImage: refs.getPendingImage,
  isPendingImageId: (id: string) => id.startsWith('localimg_'),
  createPendingImage: vi.fn(),
  deletePendingImage: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedStorage: {
    createFile: refs.createFile,
    updateFile: refs.updateFile,
  },
  guardedAccount: { get: vi.fn() },
}));

vi.mock('../../src/lib/imageCache', () => ({
  cacheImage: vi.fn().mockResolvedValue(undefined),
  getCachedImage: vi.fn(),
  deleteCachedImage: vi.fn(),
}));

vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({ status: 'online' }),
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

import { uploadPendingImage } from '../../src/lib/storage';

const localId = 'localimg_0123456789abcdef0123456789';
const remoteId = 'img_0123456789abcdef0123456789';

it('reconciles pending task images with authenticated-user read access', async () => {
  refs.getPendingImage.mockResolvedValueOnce(new Blob(['photo'], { type: 'image/webp' }));
  refs.createFile.mockResolvedValueOnce({ $id: remoteId });

  await expect(uploadPendingImage(localId, 'user_A')).resolves.toBe(remoteId);

  expect(refs.createFile).toHaveBeenCalledWith(expect.objectContaining({
    fileId: remoteId,
    permissions: [
      'read("users")',
      'update("user:user_A")',
      'delete("user:user_A")',
    ],
  }));
});

it('repairs permissions when a pending-image reconciliation races with an existing file', async () => {
  refs.getPendingImage.mockResolvedValueOnce(new Blob(['photo'], { type: 'image/webp' }));
  refs.createFile.mockRejectedValueOnce(Object.assign(new Error('Already exists'), { code: 409 }));

  await expect(uploadPendingImage(localId, 'user_A')).resolves.toBe(remoteId);

  expect(refs.updateFile).toHaveBeenCalledWith(expect.objectContaining({
    fileId: remoteId,
    permissions: [
      'read("users")',
      'update("user:user_A")',
      'delete("user:user_A")',
    ],
  }));
});
