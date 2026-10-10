import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission, Role } from 'appwrite';
import {
  normalizeStickers, parseStickerMessage, stickerLabel, stickerMessage, stickerSummary,
} from '../../src/lib/stickerProtocol';

const storage = vi.hoisted(() => ({
  getFile: vi.fn(),
  updateFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
}));
vi.mock('../../src/lib/sdk', () => ({ guardedStorage: storage }));
vi.mock('../../src/lib/imageCache', () => ({
  getCachedImage: vi.fn(), cacheImage: vi.fn(), deleteCachedImage: vi.fn(),
}));
vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({ status: 'online' }),
}));
import { allowStickerRecipient } from '../../src/lib/stickerStorage';

const fileId = 'stk_' + 'a'.repeat(32);
const owned = [
  Permission.read(Role.user('owner')),
  Permission.update(Role.user('owner')),
  Permission.delete(Role.user('owner')),
];

describe('sticker wire contract', () => {
  it('uses a readable text fallback without embedding image bytes', () => {
    const text = stickerMessage({ fileId, label: '  Cat [cute] 😻  ' });
    expect(text).toContain('[Sticker: Cat cute 😻]');
    expect(parseStickerMessage(text)).toEqual({ fileId, label: 'Cat cute 😻' });
    expect(stickerSummary(text)).toBe('Sticker: Cat cute 😻');
    expect(stickerSummary('hello')).toBe('hello');
  });

  it('does not interpret arbitrary content or mismatched image IDs as media', () => {
    expect(parseStickerMessage('[Sticker: X]\n[ms1:task_123]')).toBeNull();
    expect(parseStickerMessage('[Sticker: X]\n[ms1:' + fileId + '] extra')).toBeNull();
    expect(() => stickerMessage({ fileId: 'not_a_sticker', label: 'x' })).toThrow();
    expect(stickerLabel('\n')).toBe('Sticker');
  });

  it('accepts bounded, unique, validated personal collections only', () => {
    expect(normalizeStickers([{ fileId, label: 'One' }, { fileId, label: 'Other' }, { fileId: '../evil', label: 'Oops' }]))
      .toEqual([{ fileId, label: 'One' }]);
    expect(normalizeStickers(null)).toEqual([]);
    const entries = Array.from({ length: 50 }, (_, i) =>
      ({ fileId: 'stk_' + i.toString(16).padStart(32, '0'), label: 'Sticker ' + i }));
    expect(normalizeStickers(entries)).toHaveLength(32);
  });
});

describe('recipient-scoped sticker permissions', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('shares one existing file, without creating per-message or global copies', async () => {
    storage.getFile
      .mockResolvedValueOnce({ $permissions: owned })
      .mockResolvedValueOnce({ $permissions: [...owned, Permission.read(Role.user('friend'))] });
    storage.updateFile.mockResolvedValue({});
    await allowStickerRecipient('owner', 'friend', fileId);
    expect(storage.updateFile).toHaveBeenCalledOnce();
    expect(storage.updateFile).toHaveBeenCalledWith(expect.objectContaining({
      fileId, permissions: [...owned, Permission.read(Role.user('friend'))],
    }));
    expect(storage.createFile).not.toHaveBeenCalled();
  });

  it('reuses already shared file permissions without writing', async () => {
    storage.getFile.mockResolvedValue({ $permissions: [...owned, Permission.read(Role.user('friend'))] });
    await allowStickerRecipient('owner', 'friend', fileId);
    expect(storage.updateFile).not.toHaveBeenCalled();
  });

  it('rejects foreign and world-readable files before widening access', async () => {
    storage.getFile.mockResolvedValueOnce({ $permissions: [Permission.read(Role.users()), ...owned] });
    await expect(allowStickerRecipient('owner', 'friend', fileId)).rejects.toThrow('privately');
    storage.getFile.mockResolvedValueOnce({ $permissions: [Permission.read(Role.user('someoneElse'))] });
    await expect(allowStickerRecipient('owner', 'friend', fileId)).rejects.toThrow('privately');
    expect(storage.updateFile).not.toHaveBeenCalled();
  });

  it('rejects invalid IDs before any storage access', async () => {
    await expect(allowStickerRecipient('owner', 'friend', 'bad')).rejects.toThrow('Invalid');
    expect(storage.getFile).not.toHaveBeenCalled();
  });
});
