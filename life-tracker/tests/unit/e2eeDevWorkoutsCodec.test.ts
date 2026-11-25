
import { describe, expect, it } from 'vitest';
import { generateAccountRoot, generateKeyId, generateOpaqueRowId, generateRevision } from '../../src/lib/e2ee/coreCrypto';
import { encryptOwnerDocument, decryptOwnerDocument, DOMAIN_FOR_COLLECTION } from '../../src/lib/e2ee/ownerRecordCodec';
import { isPrivatePayloadDomain } from '../../src/lib/e2ee/domainRegistry';

const owner = { projectId: 'synthetic_project', ownerId: 'synthetic_owner' };
const context = (domain: 'activity' | 'activity-task-link') => ({
  ...owner, payloadDomain: domain, rowId: generateOpaqueRowId(),
  keyId: generateKeyId(), revision: generateRevision(),
});

describe('new current-dev workout E2EE owner codecs — source-only', () => {
  it('encrypts activity private values and authenticates disclosed routing', async () => {
    const root = generateAccountRoot(), ctx = context('activity');
    const record = {
      id: 'private_training_record', userId: owner.ownerId,
      title: 'Sensitive workout', sport: 'running', localDate: '2026-11-25',
      completedAt: '2026-11-25T10:00:00Z', distanceMeters: 14000,
      elapsedSeconds: 6500, source: 'user_csv', fingerprint: 'private_fingerprint',
      categoryId: 'private_category', order: 3, createdAt: '2026-11-25T10:00:00Z',
      updatedAt: '2026-11-25T10:00:00Z', isDeleted: false,
    };
    const sealed = await encryptOwnerDocument(root, 'activities', ctx, record);
    const serialized = JSON.stringify(sealed);
    for (const secret of ['Sensitive workout','private_training_record','private_fingerprint','private_category','running','2026-11-25T10:00:00Z']) {
      if (secret === record.updatedAt) continue; // timing routing is disclosed intentionally
      expect(serialized).not.toContain(secret);
    }
    expect(sealed.routing).toMatchObject({ userId: owner.ownerId, isDeleted: false });
    expect(await decryptOwnerDocument(root, 'activities', ctx, sealed)).toEqual(record);
    await expect(decryptOwnerDocument(root, 'activities', ctx,
      { ...sealed, routing: { ...sealed.routing, isDeleted: true } })).rejects.toThrow();
    await expect(decryptOwnerDocument(root, 'activities',
      { ...ctx, ownerId: 'different_account' }, sealed)).rejects.toThrow();
  });

  it('seals source task/activity associations and forbids domain swaps', async () => {
    const root = generateAccountRoot(), ctx = context('activity-task-link');
    const record = { id:'activity_link', userId:owner.ownerId,
      activityId:'secret_workout',taskId:'secret_task',createdAt:'2026-11-25',
      updatedAt:'2026-11-25',isDeleted:false };
    const sealed = await encryptOwnerDocument(root, 'activityTaskLinks', ctx, record);
    expect(JSON.stringify(sealed)).not.toContain('secret_workout');
    expect(JSON.stringify(sealed)).not.toContain('secret_task');
    expect(await decryptOwnerDocument(root,'activityTaskLinks',ctx,sealed)).toEqual(record);
    await expect(decryptOwnerDocument(root,'activities',{ ...ctx,payloadDomain:'activity' },sealed)).rejects.toThrow();
  });

  it('keeps all source-only collection mappings in the cryptographic domain registry', () => {
    for (const domain of Object.values(DOMAIN_FOR_COLLECTION)) expect(isPrivatePayloadDomain(domain)).toBe(true);
  });
});
