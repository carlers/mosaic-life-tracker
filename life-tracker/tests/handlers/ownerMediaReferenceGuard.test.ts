import { createRequire } from 'node:module';
import { describe, it, expect, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { referencedIds, guardOwnerMediaReferences } =
  require('../../appwrite-functions/message-action/owner-media-reference-guard.js');
const fileId = 'img_' + 'a'.repeat(32);
const nextId = 'img_' + 'b'.repeat(32);
const ledger = (status = 'verified', ownerId = 'user_a') =>
  ({ file_id: fileId, owner_id: ownerId, status });
const db = (value: unknown) => ({ getRow: vi.fn().mockResolvedValue(value) });
const fail = (code: number) => ({ getRow: vi.fn()
  .mockRejectedValue(Object.assign(new Error('unavailable'), { code })) });

describe('non-atomic media write preflight', () => {
  it('extracts references from task, Diary and settings without duplicates', () => {
    expect(referencedIds('tasks', { image: fileId })).toEqual([fileId]);
    expect(referencedIds('diary', { photos: JSON.stringify([fileId, fileId, nextId]) }))
      .toEqual([fileId, nextId]);
    expect(referencedIds('settings', { value: fileId })).toEqual([fileId]);
    expect(referencedIds('categories', { image: fileId })).toEqual([]);
  });
  it('allows a verified upload owned by the writer', async () => {
    const x = db(ledger());
    expect(await guardOwnerMediaReferences(x, 'user_a', 'tasks', { image: fileId })).toBeNull();
    expect(x.getRow).toHaveBeenCalledWith({
      databaseId: 'life_tracker', tableId: 'media_uploads', rowId: fileId,
    });
  });
  it.each(['pending_delete','deleting','deleted','unknown'])(
    'blocks %s states', async status => {
      expect(await guardOwnerMediaReferences(db(ledger(status)), 'user_a',
        'tasks', { image: fileId })).toMatchObject({ status: 409 });
    });
  it('rejects owner and evidence mismatch', async () => {
    expect(await guardOwnerMediaReferences(db(ledger('verified','other')),
      'user_a','tasks',{image:fileId})).toMatchObject({status:403});
    expect(await guardOwnerMediaReferences(db({...ledger(),file_id:nextId}),
      'user_a','tasks',{image:fileId})).toMatchObject({status:403});
  });
  it('preserves unknown legacy uploads that have no ledger', async () => {
    expect(await guardOwnerMediaReferences(fail(404),'user_a','tasks',
      {image:fileId})).toBeNull();
  });
  it('fails closed on backend outage and skips media-free writes', async () => {
    await expect(guardOwnerMediaReferences(fail(503),'user_a','tasks',
      {image:fileId})).rejects.toThrow('unavailable');
    const x = db(ledger('deleted'));
    expect(await guardOwnerMediaReferences(x,'user_a','tasks',{title:'New'})).toBeNull();
    expect(x.getRow).not.toHaveBeenCalled();
  });
});
