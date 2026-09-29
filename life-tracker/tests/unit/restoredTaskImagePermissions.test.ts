import { describe, expect, it, vi } from 'vitest';

const refs = vi.hoisted(() => ({
  accountGet: vi.fn(),
  getFile: vi.fn(),
  updateFile: vi.fn(),
  createFile: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: { get: refs.accountGet },
  guardedStorage: {
    getFile: refs.getFile,
    updateFile: refs.updateFile,
    createFile: refs.createFile,
  },
}));

vi.mock('../../src/lib/imageCache', () => ({
  getCachedImage: vi.fn(),
  cacheImage: vi.fn().mockResolvedValue(undefined),
  deleteCachedImage: vi.fn(),
}));

vi.mock('../../src/lib/pendingImages', () => ({
  createPendingImage: vi.fn(),
  deletePendingImage: vi.fn(),
  getPendingImage: vi.fn(),
  isPendingImageId: (id: string) => id.startsWith('localimg_'),
}));

vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({ status: 'online' }),
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

import { ensureRestoredImage } from '../../src/lib/storage';

function makeFile(): File {
  return new File(['photo'], 'photo.png', { type: 'image/png' });
}

describe('ensureRestoredImage — friend-readable task attachments', () => {
  it('repairs an existing imported/restored file for friend reads', async () => {
    refs.accountGet.mockResolvedValueOnce({ $id: 'user_A' });
    refs.getFile.mockResolvedValueOnce({ $id: 'tmimg_existing' });

    await expect(ensureRestoredImage(makeFile(), 'tmimg_existing')).resolves.toEqual({
      fileId: 'tmimg_existing',
      uploaded: false,
    });

    expect(refs.updateFile).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'tmimg_existing',
      permissions: [
        'read("users")',
        'update("user:user_A")',
        'delete("user:user_A")',
      ],
    }));
  });

  it('creates missing imported/restored files with friend-readable permissions', async () => {
    refs.accountGet.mockResolvedValueOnce({ $id: 'user_A' });
    refs.getFile.mockRejectedValueOnce(Object.assign(new Error('Not found'), { code: 404 }));
    refs.createFile.mockResolvedValueOnce({ $id: 'tmimg_new' });

    await expect(ensureRestoredImage(makeFile(), 'tmimg_new')).resolves.toEqual({
      fileId: 'tmimg_new',
      uploaded: true,
    });

    expect(refs.createFile).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'tmimg_new',
      permissions: [
        'read("users")',
        'update("user:user_A")',
        'delete("user:user_A")',
      ],
    }));
  });
});
