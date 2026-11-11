import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { Permission, Role } from 'node-appwrite';
const require = createRequire(import.meta.url);
const { chatPhotoFileId, grantChatPhoto, deleteChatPhoto } = require('../../appwrite-functions/message-action/chat-photo-auth.js') as {
  chatPhotoFileId: (id: string) => string | null;
  grantChatPhoto: (storage: unknown, sender: string, recipient: string, messageId: string, fileId: string) => Promise<{ status: number } | null>;
  deleteChatPhoto: (storage: unknown, sender: string, messageId: string, fileId: string) => Promise<void>;
};
const sender = 'sender_a', recipient = 'recipient_b';
const messageId = 'msg_1730000000000_testabc';
const fileId = 'chat_1730000000000_testabc';
const ownerPerms = [
  Permission.read(Role.user(sender)),
  Permission.update(Role.user(sender)),
  Permission.delete(Role.user(sender)),
];
function storage(permissions = [...ownerPerms], bucketPerms = ['create("users")']) {
  let current = permissions;
  const getBucket = vi.fn(async () => ({ fileSecurity: true, $permissions: bucketPerms }));
  const getFile = vi.fn(async () => ({ mimeType: 'image/webp', sizeOriginal: 180000, $permissions: current }));
  const updateFile = vi.fn(async ({ permissions: updated }: { permissions: string[] }) => { current = updated; });
  return { getBucket, getFile, updateFile };
}
describe('server-scoped chat photo access', () => {
  it('requires deterministic IDs and cannot reference task photos', () => {
    expect(chatPhotoFileId(messageId)).toBe(fileId);
    expect(chatPhotoFileId('invalid')).toBeNull();
  });
  it('grants read only to the recipient, preserving owner controls', async () => {
    const mock = storage();
    expect(await grantChatPhoto(mock, sender, recipient, messageId, fileId)).toBeNull();
    expect(mock.updateFile).toHaveBeenCalledWith({
      bucketId: 'task_images', fileId,
      permissions: [...ownerPerms, Permission.read(Role.user(recipient))],
    });
  });
  it('does not acknowledge recipient access if Storage drops a successful-looking ACL update', async () => {
    const mock = storage();
    mock.updateFile.mockImplementation(async () => {});
    expect((await grantChatPhoto(mock, sender, recipient, messageId, fileId))?.status).toBe(503);
    expect(mock.getFile).toHaveBeenCalledTimes(2);
    expect(mock.updateFile).toHaveBeenCalledTimes(1);
  });

  it('fails closed if a stranger grant appears after initial ownership validation', async () => {
    const mock = storage();
    mock.getFile.mockResolvedValueOnce({
      mimeType: 'image/webp', sizeOriginal: 180000, $permissions: ownerPerms,
    }).mockResolvedValueOnce({
      mimeType: 'image/webp', sizeOriginal: 180000,
      $permissions: [...ownerPerms, Permission.read(Role.user(recipient)), Permission.read(Role.user('outsider'))],
    });
    expect((await grantChatPhoto(mock, sender, recipient, messageId, fileId))?.status).toBe(503);
    expect(mock.updateFile).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid MIME type, empty files and oversized attachments before grants', async () => {
    for (const file of [
      { mimeType: 'image/png', sizeOriginal: 180000 },
      { mimeType: 'image/webp', sizeOriginal: 0 },
      { mimeType: 'image/webp', sizeOriginal: 262145 },
      { mimeType: 'image/webp', sizeOriginal: Number.NaN },
    ]) {
      const mock = storage();
      mock.getFile.mockResolvedValue({ ...file, $permissions: ownerPerms });
      expect((await grantChatPhoto(mock, sender, recipient, messageId, fileId))?.status).toBe(415);
      expect(mock.updateFile).not.toHaveBeenCalled();
    }
  });

  it('requires sender delete ownership before removing a chat photo', async () => {
    const deleteFile = vi.fn();
    const getFile = vi.fn().mockResolvedValue({
      $permissions: [
        Permission.read(Role.user(sender)),
        Permission.delete(Role.user('outsider')),
      ],
    });
    await expect(deleteChatPhoto({ getFile, deleteFile }, sender, messageId, fileId))
      .rejects.toThrow('Photo owner mismatch');
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('permits the actual sender to unsend a recipient-readable photo', async () => {
    const deleteFile = vi.fn().mockResolvedValue({});
    const getFile = vi.fn().mockResolvedValue({
      $permissions: [...ownerPerms, Permission.read(Role.user(recipient))],
    });
    await expect(deleteChatPhoto({ getFile, deleteFile }, sender, messageId, fileId))
      .resolves.toBeUndefined();
    expect(deleteFile).toHaveBeenCalledWith({ bucketId: 'task_images', fileId });
  });
  it('fails if bucket-wide read makes per-file privacy unenforceable', async () => {
    const mock = storage([...ownerPerms], ['read("users")']);
    expect((await grantChatPhoto(mock, sender, recipient, messageId, fileId))?.status).toBe(503);
    expect(mock.updateFile).not.toHaveBeenCalled();
  });
  it('rejects stranger read permissions and another file ID', async () => {
    const mock = storage([...ownerPerms, Permission.read(Role.user('other'))]);
    expect((await grantChatPhoto(mock, sender, recipient, messageId, fileId))?.status).toBe(403);
    expect((await grantChatPhoto(mock, sender, recipient, messageId, 'img_task'))?.status).toBe(400);
    expect(mock.updateFile).not.toHaveBeenCalled();
  });
});
