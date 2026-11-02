import { describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const sender = 'person_a';
const recipient = 'person_b';
const messageId = 'msg_1730000000000_photoabc';
const fileId = 'chat_1730000000000_photoabc';
const photo = { action: 'deliver', messageId, recipientId: recipient,
  attachmentType: 'image', attachmentFileId: fileId, content: '[Photo]\\nCaption' };
const ownerPerms = ['read("user:person_a")', 'update("user:person_a")', 'delete("user:person_a")'];
const recipientRead = 'read("user:person_b")';
const notFound = Object.assign(new Error('not found'), { code: 404 });

function setup(perms = [...ownerPerms]) {
  const db = makeMockDb();
  db.listRows.mockResolvedValue({ rows: [{ $id: 'accepted' }] });
  let grants = [...perms];
  const storage = makeMockStorage();
  storage.getBucket = vi.fn().mockResolvedValue({ fileSecurity: true, $permissions: ['create("users")'] });
  storage.getFile = vi.fn().mockImplementation(async () => ({
    mimeType: 'image/webp', sizeOriginal: 128000, $permissions: [...grants],
  }));
  storage.updateFile = vi.fn().mockImplementation(async ({ permissions }: { permissions: string[] }) => {
    grants = permissions;
  });
  return { db, storage };
}

describe('trusted chat photo delivery', () => {
  it('refuses message/file ID mismatch before row writes', async () => {
    const { db, storage } = setup();
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage,
      body: { ...photo, attachmentFileId: 'img_untrusted' } });
    expect(result.status).toBe(400);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(storage.updateFile).not.toHaveBeenCalled();
  });

  it('refuses a sender who is not an accepted friend', async () => {
    const { db, storage } = setup();
    db.listRows.mockResolvedValue({ rows: [] });
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage, body: photo });
    expect(result.status).toBe(403);
    expect(storage.updateFile).not.toHaveBeenCalled();
  });

  it('rejects stranger access and does not persist a photo message', async () => {
    const { db, storage } = setup([...ownerPerms, 'read("users")']);
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage, body: photo });
    expect(result.status).toBe(403);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('grants recipient read-only and creates matching sender/recipient message rows', async () => {
    const { db, storage } = setup();
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage, body: photo });
    expect(result.status).toBe(200);
    expect(storage.updateFile).toHaveBeenCalledWith({
      bucketId: 'task_images', fileId,
      permissions: [...ownerPerms, recipientRead],
    });
    const rows = db.createRow.mock.calls.map(([data]: [Record<string, any>]) => data);
    expect(rows.filter(row => row.tableId === 'messages')).toHaveLength(2);
    for (const row of rows.filter(row => row.tableId === 'messages')) {
      expect(row.data).toEqual(expect.objectContaining({
        attachment_type: 'image', attachment_file_id: fileId,
        content: photo.content,
      }));
    }
  });

  it('refuses an unavailable file without creating either message copy', async () => {
    const { db, storage } = setup();
    storage.getFile = vi.fn().mockRejectedValue(notFound);
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage, body: photo });
    expect(result.status).toBe(422);
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe('trusted chat photo unsend', () => {
  const recipientRowId = 'rmsg_placeholder'; // determined by the hash below, not client-provided
  function existingRows(db: ReturnType<typeof makeMockDb>) {
    db.getRow.mockImplementation(async ({ rowId }: { rowId: string }) => {
      if (rowId === messageId) return { $id: messageId,
        user_id: sender, direction: 'outgoing', sender_id: sender,
        recipient_id: recipient, attachment_type: 'image', attachment_file_id: fileId };
      if (rowId.startsWith('rmsg_')) return { $id: rowId, user_id: recipient,
        direction: 'incoming', sender_id: sender, recipient_id: recipient,
        original_message_id: messageId, attachment_type: 'image', attachment_file_id: fileId };
      throw notFound;
    });
  }

  it('deletes owned media before wiping both message references', async () => {
    const { db, storage } = setup([...ownerPerms, recipientRead]);
    existingRows(db);
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage,
      body: { action: 'unsend', messageId, recipientId: recipient } });
    expect(result.status).toBe(200);
    expect(storage.deleteFile).toHaveBeenCalledWith({ bucketId: 'task_images', fileId });
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'messages', data: expect.objectContaining({
        is_unsent: true, attachment_type: '', attachment_file_id: '',
      }),
    }));
  });

  it('does not wipe references when media deletion fails', async () => {
    const { db, storage } = setup([...ownerPerms, recipientRead]);
    existingRows(db);
    storage.deleteFile = vi.fn().mockRejectedValue(Error('temporary failure'));
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage,
      body: { action: 'unsend', messageId, recipientId: recipient } });
    expect(result.status).toBe(503);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('does not delete a file when the recipient peer has conflicting identity', async () => {
    const { db, storage } = setup([...ownerPerms, recipientRead]);
    existingRows(db);
    db.getRow.mockImplementation(async ({ rowId }: { rowId: string }) => ({
      $id: rowId,
      user_id: rowId === messageId ? sender : 'stranger',
      direction: rowId === messageId ? 'outgoing' : 'incoming',
      sender_id: sender, recipient_id: recipient, original_message_id: messageId,
      attachment_type: 'image', attachment_file_id: fileId,
    }));
    const result = await invoke({ userId: sender, mockDb: db, mockStorage: storage,
      body: { action: 'unsend', messageId, recipientId: recipient } });
    expect(result.status).toBe(409);
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
});
