import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission, Role } from 'appwrite';
import {
  normalizeStickers, parseStickerMessage, stickerLabel, stickerMessage, stickerSummary,
} from '../../src/lib/stickerProtocol';

const images = vi.hoisted(() => ({
  getCachedImage: vi.fn(), cacheImage: vi.fn(), deleteCachedImage: vi.fn(),
}));
const pending = vi.hoisted(() => ({
  stagePendingSticker: vi.fn(), getPendingSticker: vi.fn(), deletePendingSticker: vi.fn(),
}));
const storage = vi.hoisted(() => ({
  getFileView: vi.fn(),
  getFile: vi.fn(),
  updateFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
}));
vi.mock('../../src/lib/sdk', () => ({ guardedStorage: storage }));
vi.mock('../../src/lib/imageCache', () => images);
vi.mock('../../src/lib/pendingImages', () => pending);
vi.mock('../../src/lib/connectivity', () => ({
  getConnectivitySnapshot: () => ({ status: 'online' }),
  reportConnectivityResult: vi.fn(),
}));
import { allowStickerRecipient, loadStickerImage, recipientStickerId, prepareOutgoingSticker, settleOutgoingSticker } from '../../src/lib/stickerStorage';
import { __resetAccountWorkScopeForTests, scopeAccountWork } from '../../src/lib/accountWorkScope';

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

describe('efficient and account-scoped sticker downloads', () => {
  const source = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
  let originalCreateObjectURL: typeof URL.createObjectURL;

  beforeEach(() => {
    vi.resetAllMocks();
    __resetAccountWorkScopeForTests();
    scopeAccountWork('owner');
    images.getCachedImage.mockResolvedValue(undefined);
    images.cacheImage.mockResolvedValue(undefined);
    // Keyboard media uses a durable pending store; these tests exercise remote reads.
    pending.getPendingSticker.mockResolvedValue(null);
    storage.getFileView.mockReturnValue({ toString: () => 'https://fra.cloud.appwrite.io/v1/storage/mock' });
    originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:sticker');
  });
  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    vi.unstubAllGlobals();
  });

  it('coalesces simultaneous renders of a single sticker into one network transfer', async () => {
    let complete!: (response: Response) => void;
    const fetched = new Promise<Response>(resolve => { complete = resolve; });
    const fetchMock = vi.fn(() => fetched);
    vi.stubGlobal('fetch', fetchMock);
    const first = loadStickerImage(fileId, 'owner');
    const second = loadStickerImage(fileId, 'owner');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    complete({ ok: true, blob: async () => source } as Response);
    expect(await Promise.all([first, second])).toEqual(['blob:sticker', 'blob:sticker']);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(images.getCachedImage).toHaveBeenCalledOnce();
    expect(images.cacheImage).toHaveBeenCalledOnce();
  });

  it('does not display or cache a stale response after an account switch', async () => {
    let complete!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { complete = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = loadStickerImage(fileId, 'owner');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    scopeAccountWork('different');
    complete({ ok: true, blob: async () => source } as Response);
    expect(await pending).toBeNull();
    expect(images.cacheImage).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('renders an online sticker even when IndexedDB caching is unavailable', async () => {
    images.getCachedImage.mockRejectedValueOnce(new Error('IndexedDB inaccessible'));
    images.cacheImage.mockRejectedValueOnce(new Error('Quota exceeded'));
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => source }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadStickerImage(fileId, 'owner')).toBe('blob:sticker');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('keyboard-native sticker send authorization', () => {
  const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
  beforeEach(() => {
    vi.resetAllMocks();
    pending.getPendingSticker.mockResolvedValue(bytes);
    pending.deletePendingSticker.mockResolvedValue(undefined);
    storage.createFile.mockResolvedValue({});
    storage.getFile.mockResolvedValue({ $permissions: [...owned, Permission.read(Role.user('friend'))] });
  });

  it('deduplicates the same sticker for one friend, but isolates different recipients', async () => {
    const a = await recipientStickerId('owner', 'friend', bytes);
    const same = await recipientStickerId('owner', 'friend', bytes);
    const other = await recipientStickerId('owner', 'other', bytes);
    const differentOwner = await recipientStickerId('someoneElse', 'friend', bytes);
    expect(a).toEqual(same);
    expect(a).toMatch(/^stk_[0-9a-f]{32}$/);
    expect(new Set([a, other, differentOwner]).size).toBe(3);
  });

  it('uploads once with narrowly scoped permissions, without a permission array rewrite', async () => {
    await prepareOutgoingSticker('owner', 'friend', fileId);
    expect(storage.createFile).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      fileId,
      permissions: [...owned, Permission.read(Role.user('friend'))],
    }));
    expect(storage.getFile).toHaveBeenCalledOnce();
    expect(storage.updateFile).not.toHaveBeenCalled();
    await settleOutgoingSticker('owner', fileId);
    expect(pending.deletePendingSticker).toHaveBeenCalledExactlyOnceWith(fileId, 'owner');
  });

  it('fails closed when a colliding ID does not have verified recipient access', async () => {
    storage.createFile.mockRejectedValueOnce({ code: 409 });
    storage.getFile.mockResolvedValueOnce({ $permissions: [...owned, Permission.read(Role.user('wrong'))] });
    await expect(prepareOutgoingSticker('owner', 'friend', fileId)).rejects.toThrow('permissions');
    expect(storage.updateFile).not.toHaveBeenCalled();
    expect(pending.deletePendingSticker).not.toHaveBeenCalled();
  });

  it('keeps legacy personal-picker stickers readable without reuploading', async () => {
    pending.getPendingSticker.mockResolvedValueOnce(null);
    await prepareOutgoingSticker('owner', 'friend', fileId);
    expect(storage.createFile).not.toHaveBeenCalled();
    expect(storage.updateFile).not.toHaveBeenCalled();
  });
});
