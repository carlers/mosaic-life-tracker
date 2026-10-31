import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { Permission, Role } from 'node-appwrite';
const require = createRequire(import.meta.url);
const { chatPhotoFileId, grantChatPhoto } = require('../../appwrite-functions/message-action/chat-photo-auth.js') as {
  chatPhotoFileId: (id: string) => string | null;
  grantChatPhoto: (storage: unknown, sender: string, recipient: string, messageId: string, fileId: string) => Promise<{ status: number } | null>;
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
