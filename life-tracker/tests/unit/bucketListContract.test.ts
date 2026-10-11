import { describe, expect, it } from 'vitest';
import { bucketListSchema } from '../../src/db/schema';
import { fromAppwriteFormat, toAppwriteFormat } from '../../src/lib/syncMapping';
import { ACCOUNT_ERASURE_POLICY, assertErasurePolicyCoversManifest } from '../../infrastructure/account-erasure-policy.mjs';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';

describe('private Bucket List contract', () => {
  const record = {
    id: 'b_example', userId: 'owner', title: 'See the northern lights',
    description: 'Sometime in the future', achieved: true,
    achievedAt: '2026-10-11T08:00:00.000Z',
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-11T08:00:00.000Z',
    isDeleted: false,
  };

  it('never maps an aspiration to ordinary tasks or visibility fields', () => {
    const payload = toAppwriteFormat(record, 'bucketList', 'owner');
    expect(payload).toMatchObject({
      user_id: 'owner', title: record.title, description: record.description,
      achieved: true, achieved_at: record.achievedAt,
      created_at: record.createdAt, updated_at: record.updatedAt, deleted: false,
    });
    expect(payload).not.toHaveProperty('category_id');
    expect(payload).not.toHaveProperty('visibility');
    expect(payload).not.toHaveProperty('date');
    const restored = fromAppwriteFormat({ $id: record.id, ...payload }, 'bucketList');
    expect(restored).toMatchObject(record);
  });

  it('retains an achievement tombstone as data, not an RxDB physical deletion', () => {
    const mapped = fromAppwriteFormat({
      $id: record.id, ...toAppwriteFormat({ ...record, isDeleted: true, achieved: false, achievedAt: '' }, 'bucketList', 'owner'),
    }, 'bucketList');
    expect(mapped.isDeleted).toBe(true);
    expect(mapped.achievedAt).toBe('');
  });

  it('registers owner-only row security and account erasure', () => {
    const table = MOSAIC_TABLES.find(item => item.id === 'bucket_list_items');
    expect(table).toBeDefined();
    expect(table?.rowSecurity).toBe(true);
    expect(table?.permissions).toEqual(['create("users")']);
    expect(ACCOUNT_ERASURE_POLICY.tables.bucket_list_items).toEqual({ kind: 'owned', ownerField: 'user_id' });
    expect(assertErasurePolicyCoversManifest()).toBe(true);
    expect(bucketListSchema.required).toContain('achievedAt');
  });
});
