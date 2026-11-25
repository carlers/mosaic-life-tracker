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
    expect(remote.routing).toMatchObject({ date: source.date, userId: owner.ownerId });
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
      { ...remote, routing: { ...remote.routing, date: '2026-11-20' } })).rejects.toThrow();
    await expect(decryptOwnerDocument(key, 'tasks', c,
      { ...remote, routing: { ...remote.routing, title: 'plaintext!' } })).rejects.toThrow();
    await expect(decryptOwnerDocument(key, 'tasks', c,
      { ...remote, rowId: generateOpaqueRowId() })).rejects.toThrow();
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
