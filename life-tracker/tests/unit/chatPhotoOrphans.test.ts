import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { Permission, Role } from 'node-appwrite';

const require = createRequire(import.meta.url);
const { cleanupAbandonedChatPhotos, ownerOfPrivatePhoto } =
  require('../../appwrite-functions/message-action/chat-photo-orphans.js') as {
    cleanupAbandonedChatPhotos: (db: unknown, storage: unknown, opts?: unknown) => Promise<{ purged: number; retained: number; failed: number }>;
    ownerOfPrivatePhoto: (file: unknown) => string | null;
  };
const sender = 'person_a';
const fileId = 'chat_1730000000000_testabc';
const msgId = 'msg_1730000000000_testabc';
const ownerPermissions = [
  Permission.read(Role.user(sender)), Permission.update(Role.user(sender)),
  Permission.delete(Role.user(sender)),
];
const agedFile = { $id: fileId, name: fileId + '.webp', mimeType: 'image/webp',
  $createdAt: '2026-09-01T00:00:00.000Z', $permissions: ownerPermissions };
const missing = Object.assign(Error('missing'), { code: 404 });
function fixture(files = [agedFile]) {
  const getBucket = vi.fn().mockResolvedValue({ fileSecurity: true, $permissions: ['create("users")'] });
  const listFiles = vi.fn().mockResolvedValue({ files });
  const getFile = vi.fn().mockResolvedValue(agedFile);
  const deleteFile = vi.fn().mockResolvedValue({});
  const db = { getRow: vi.fn().mockRejectedValue(missing) };
  return { db, storage: { getBucket, listFiles, getFile, deleteFile }, deleteFile };
}
describe('bounded server-owned orphan chat photo reclamation', () => {
  it('recognizes exactly private owner-only chat files', () => {
    expect(ownerOfPrivatePhoto(agedFile)).toBe(sender);
    expect(ownerOfPrivatePhoto({ ...agedFile, $permissions: [
      ...ownerPermissions, Permission.read(Role.user('stranger'))] })).toBeNull();
    expect(ownerOfPrivatePhoto({ ...agedFile, $id: 'img_task' })).toBeNull();
  });
  it('deletes a stale owner-only file without any sender row', async () => {
    const { db, storage, deleteFile } = fixture();
    const result = await cleanupAbandonedChatPhotos(db, storage,
      { now: new Date('2026-10-31T00:00:00.000Z') });
    expect(result.purged).toBe(1);
    expect(db.getRow).toHaveBeenCalledWith({
      databaseId: 'life_tracker', tableId: 'messages', rowId: msgId,
    });
    expect(deleteFile).toHaveBeenCalledWith({ bucketId: 'task_images', fileId });
  });
  it('never deletes a live message file, even after 14 days', async () => {
    const { db, storage, deleteFile } = fixture();
    db.getRow.mockResolvedValue({ $id: msgId });
    const result = await cleanupAbandonedChatPhotos(db, storage,
      { now: new Date('2026-10-31T00:00:00.000Z') });
    expect(result.retained).toBe(1);
    expect(deleteFile).not.toHaveBeenCalled();
  });
  it('does not delete fresh uploads, recipient-granted media or unknown files', async () => {
    const files = [{ ...agedFile, $createdAt: '2026-10-30T00:00:00.000Z' },
      { ...agedFile, $permissions: [...ownerPermissions, Permission.read(Role.user('person_b'))] },
      { ...agedFile, name: 'img_task.webp' }];
    const { db, storage, deleteFile } = fixture(files);
    const result = await cleanupAbandonedChatPhotos(db, storage,
      { now: new Date('2026-10-31T00:00:00.000Z') });
    expect(result.retained).toBe(3);
    expect(db.getRow).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });
  it('fails closed on unexpected bucket reads or database errors', async () => {
    const f = fixture();
    f.storage.getBucket.mockResolvedValue({ fileSecurity: true, $permissions: ['read("users")'] });
    await expect(cleanupAbandonedChatPhotos(f.db, f.storage)).rejects.toThrow(/Unsafe bucket/);
    expect(f.deleteFile).not.toHaveBeenCalled();
    f.storage.getBucket.mockResolvedValue({ fileSecurity: true, $permissions: [] });
    f.db.getRow.mockRejectedValue(Error('temporary'));
    const result = await cleanupAbandonedChatPhotos(f.db, f.storage,
      { now: new Date('2026-10-31T00:00:00.000Z') });
    expect(result.failed).toBe(1);
    expect(f.deleteFile).not.toHaveBeenCalled();
  });
});
