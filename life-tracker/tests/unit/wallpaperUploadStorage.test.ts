import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission, Role } from 'appwrite';
import {
  listOwnerWallpaperSlots, uploadOwnerWallpaper, deleteOwnerWallpaper,
  wallpaperFileIdForOwner, MAX_WALLPAPER_UPLOADS,
} from '../../src/lib/wallpaperUploadStorage';

const env = vi.hoisted(() => ({
  currentOwner: 'account-A',
  files: new Map<string, { mimeType: string; sizeOriginal: number; $permissions: string[] }>(),
  deletes: [] as string[],
}));
vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: { get: async () => ({ $id: env.currentOwner }) },
  guardedStorage: {
    getFile: async ({ fileId }: { fileId: string }) => {
      const file = env.files.get(fileId);
      if (!file) throw Object.assign(new Error('not found'), { code: 404 });
      return file;
    },
    createFile: async ({ fileId, file, permissions }: {
      fileId: string; file: File; permissions: string[];
    }) => {
      if (env.files.has(fileId)) throw Object.assign(new Error('conflict'), { code: 409 });
      const record = { mimeType: file.type, sizeOriginal: file.size, $permissions: permissions };
      env.files.set(fileId, record);
      return record;
    },
    deleteFile: async ({ fileId }: { fileId: string }) => {
      env.deletes.push(fileId);
      env.files.delete(fileId);
    },
  },
}));
vi.mock('../../src/lib/imageCache', () => ({
  cacheImage: async () => {}, deleteCachedImage: async () => {},
}));
vi.mock('browser-image-compression', () => ({
  default: async () => new Blob([new Uint8Array(512)], { type: 'image/webp' }),
}));
const jpeg = () => new File([new Uint8Array(1024)], 'wallpaper.jpg', { type: 'image/jpeg' });
beforeEach(() => { env.currentOwner = 'account-A'; env.files.clear(); env.deletes.length = 0; });

describe('Owner-private wallpaper upload slots', () => {
  it('uses only five deterministic IDs and keeps owner-exclusive ACLs', async () => {
    expect(MAX_WALLPAPER_UPLOADS).toBe(5);
    for (let slot = 0; slot < 5; slot++) {
      const result = await uploadOwnerWallpaper('account-A', jpeg());
      expect(result).toBe(slot);
      const id = wallpaperFileIdForOwner('account-A', result);
      expect(id.length).toBeLessThanOrEqual(36);
      const permissions = env.files.get(id)!.$permissions;
      expect(permissions).toEqual([
        Permission.read(Role.user('account-A')),
        Permission.update(Role.user('account-A')),
        Permission.delete(Role.user('account-A')),
      ]);
      expect(permissions.join(' ')).not.toContain('users');
    }
    expect(await listOwnerWallpaperSlots('account-A')).toEqual([0,1,2,3,4]);
    await expect(uploadOwnerWallpaper('account-A', jpeg())).rejects.toThrow(/Maximum of five/);
    expect(env.files.size).toBe(5);
  });
  it('does not read, delete or upload another account’s private files', async () => {
    const slot = await uploadOwnerWallpaper('account-A', jpeg());
    const fileId = wallpaperFileIdForOwner('account-A', slot);
    env.currentOwner = 'account-B';
    await expect(listOwnerWallpaperSlots('account-A')).rejects.toThrow(/Account changed/);
    await expect(deleteOwnerWallpaper('account-A', slot)).rejects.toThrow(/Account changed/);
    await expect(uploadOwnerWallpaper('account-A', jpeg())).rejects.toThrow(/Account changed/);
    expect(env.files.has(fileId)).toBe(true);
    expect(env.deletes).toEqual([]);
    expect(wallpaperFileIdForOwner('account-B', 0)).not.toBe(fileId);
  });
  it('reuses a deleted slot but never deletes a different media ID', async () => {
    for (let i=0; i<5; i++) await uploadOwnerWallpaper('account-A', jpeg());
    const target = wallpaperFileIdForOwner('account-A', 2);
    await deleteOwnerWallpaper('account-A', 2);
    expect(env.deletes).toEqual([target]);
    expect(await listOwnerWallpaperSlots('account-A')).toEqual([0,1,3,4]);
    expect(await uploadOwnerWallpaper('account-A', jpeg())).toBe(2);
  });
  it('rejects unsupported and oversized originals before contacting Storage', async () => {
    await expect(uploadOwnerWallpaper('account-A',
      new File(['hi'], 'wall.svg', {type:'image/svg+xml'}))).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(uploadOwnerWallpaper('account-A',
      new File([new Uint8Array(12*1024*1024+1)], 'huge.jpg', {type:'image/jpeg'})))
      .rejects.toThrow(/12 MB/);
    expect(env.files.size).toBe(0);
  });
});
