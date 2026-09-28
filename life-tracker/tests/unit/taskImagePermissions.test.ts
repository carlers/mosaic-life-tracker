import { describe, expect, it, vi } from 'vitest';

const createFile = vi.hoisted(() => vi.fn());
const cacheImage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getConnectivitySnapshot = vi.hoisted(() => vi.fn(() => ({ status: 'online' })));

vi.mock('../../src/lib/sdk', () => ({
  guardedStorage: { createFile },
  guardedAccount: { get: vi.fn() },
}));
vi.mock('../../src/lib/imageCache', () => ({
  getCachedImage: vi.fn(),
  cacheImage,
  deleteCachedImage: vi.fn(),
}));
vi.mock('../../src/lib/connectivity', () => ({ getConnectivitySnapshot }));
vi.mock('../../src/lib/pendingImages', () => ({
  createPendingImage: vi.fn(),
  deletePendingImage: vi.fn(),
  getPendingImage: vi.fn(),
  isPendingImageId: (id: string) => id.startsWith('localimg_'),
}));
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

import { saveImage } from '../../src/lib/storage';

function makeFile(): File {
  return new File(['task-photo'], 'task.png', { type: 'image/png' });
}

describe('task image storage permissions', () => {
  it('allows authenticated friends to read task attachments while keeping writes owner-only', async () => {
    createFile.mockResolvedValueOnce({ $id: 'img_task' });

    await expect(saveImage(makeFile(), 'user_A')).resolves.toMatch(/^img_/);

    expect(createFile).toHaveBeenCalledWith(expect.objectContaining({
      permissions: [
        'read("users")',
        'update("user:user_A")',
        'delete("user:user_A")',
      ],
    }));
  });
});
