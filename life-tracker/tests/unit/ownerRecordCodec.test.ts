import { describe, expect, it } from 'vitest';
import { generateAccountRoot, generateKeyId, generateOpaqueRowId, generateRevision } from '../../src/lib/e2ee/coreCrypto';
import { encryptOwnerDocument, decryptOwnerDocument } from '../../src/lib/e2ee/ownerRecordCodec';

const owner = { projectId: 'scratch_project', ownerId: 'synthetic_owner' };
const root = () => generateAccountRoot();
function ctx(domain: 'diary' | 'task' | 'chat-message' | 'social-private' = 'task') {
  return { ...owner, payloadDomain: domain, rowId: generateOpaqueRowId(),
    keyId: generateKeyId(), revision: generateRevision() };
}
describe('M2 encrypted owner record routing (source-only)', () => {
  it('seals original record IDs, text, category and private fields with opaque remote ID', async () => {
    const key = root(), c = ctx(), source = {
      id: 'task_secret_semantic_ID', userId: owner.ownerId, title: 'Sensitive school task',
      categoryId: 'c_secret', date: '2026-11-19', completed: false, isDeleted: false,
    };
    const remote = await encryptOwnerDocument(key, 'tasks', c, source);
    expect(remote.rowId).toBe(c.rowId);
    expect(remote.routing).toMatchObject({ userId: owner.ownerId });
    expect(remote.routing).not.toHaveProperty('date');
    expect(JSON.stringify(remote)).not.toContain('2026-11-19');
    expect(JSON.stringify(remote)).not.toContain('Sensitive school task');
    expect(JSON.stringify(remote)).not.toContain('task_secret_semantic_ID');
    expect(await decryptOwnerDocument(key, 'tasks', c, remote)).toEqual(source);
  });
  it('rejects tampered disclosed routing metadata by AEAD binding', async () => {
    const key = root(), c = ctx(), source = {
      id: 't', userId: owner.ownerId, title: 'secret', date: '2026-11-19',
      isDeleted: false,
    };
    const remote = await encryptOwnerDocument(key, 'tasks', c, source);
    await expect(decryptOwnerDocument(key, 'tasks', c,
      { ...remote, routing: { ...remote.routing, isDeleted: true } })).rejects.toThrow();
    await expect(decryptOwnerDocument(key, 'tasks', c,
      { ...remote, routing: { ...remote.routing, title: 'plaintext!' } })).rejects.toThrow();
    await expect(decryptOwnerDocument(key, 'tasks', c,
      { ...remote, rowId: generateOpaqueRowId() })).rejects.toThrow();
  });
  it('seals diary dates, visibility and personal reminders rather than exposing calendar metadata', async () => {
    const key = root(), diary = ctx('diary');
    const journal = {
      id: 'journal_private_day', userId: owner.ownerId, date: '2041-06-21',
      content: 'confidential journal text', visibility: 'private', isDeleted: false,
    };
    const sealed = await encryptOwnerDocument(key, 'diary', diary, journal);
    expect(sealed.routing).not.toHaveProperty('date');
    expect(sealed.routing).not.toHaveProperty('visibility');
    for (const secret of ['2041-06-21','confidential journal text','journal_private_day']) {
      expect(JSON.stringify(sealed)).not.toContain(secret);
    }
    expect(await decryptOwnerDocument(key, 'diary', diary, sealed)).toEqual(journal);
    await expect(decryptOwnerDocument(key, 'diary', diary, {
      ...sealed, routing: { ...sealed.routing, userId: 'attacker' },
    })).rejects.toThrow();
    await expect(decryptOwnerDocument(key, 'diary', diary, {
      ...sealed, routing: { isDeleted:false },
    })).rejects.toThrow();
  });
  it('seals task dates, reminder times and access labels in client-only bytes', async () => {
    const key = root(), c = ctx();
    const task = {
      id:'task_private',userId:owner.ownerId,title:'private',date:'2041-09-08',
      reminderTime:'21:15',visibility:'private',isDeleted:false,
    };
    const row = await encryptOwnerDocument(key,'tasks',c,task);
    expect(row.routing).not.toHaveProperty('date');
    expect(row.routing).not.toHaveProperty('reminderTime');
    expect(row.routing).not.toHaveProperty('visibility');
    expect(JSON.stringify(row)).not.toContain('2041-09-08');
    expect(JSON.stringify(row)).not.toContain('21:15');
    expect(await decryptOwnerDocument(key,'tasks',c,row)).toEqual(task);
  });
  it('blocks unknown fields and unapproved public disclosures', async () => {
    const key = root(), c = ctx('social-private');
    const row = { id: 'f', userId: owner.ownerId, friendId: 'other',
      friendUsername: 'public-name', status: 'accepted' };
    await expect(encryptOwnerDocument(key, 'friendships', c, row)).rejects.toThrow();
    const allowed = await encryptOwnerDocument(key, 'friendships', c, row, true);
    expect(allowed.published).toEqual({ friendUsername: 'public-name' });
    expect(await decryptOwnerDocument(key, 'friendships', c, allowed, true)).toEqual(row);
    await expect(encryptOwnerDocument(key, 'friendships', c,
      { ...row, unclassifiedData: 'secret' }, true)).rejects.toThrow();
  });
  it('never silently accepts plaintext or wrong domain ciphertext', async () => {
    const key = root(), c = ctx('chat-message');
    const source = { id: 'm', userId: owner.ownerId, content: 'private message',
      threadId: 'threadA', senderId: owner.ownerId, recipientId: 'friend' };
    const remote = await encryptOwnerDocument(key, 'messages', c, source);
    expect(JSON.stringify(remote)).not.toContain('private message');
    await expect(decryptOwnerDocument(key, 'messages', c,
      { ...remote, envelope: { title: 'plaintext' } as unknown as typeof remote.envelope })).rejects.toThrow();
    await expect(decryptOwnerDocument(key, 'tasks',
      { ...c, payloadDomain: 'task' }, remote)).rejects.toThrow();
  });
});
