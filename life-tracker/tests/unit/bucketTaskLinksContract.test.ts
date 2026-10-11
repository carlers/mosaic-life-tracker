import { describe, expect, it, vi } from 'vitest';
import { makeBucketTaskLinkId } from '../../src/lib/bucketTaskLinkId';
import { fromAppwriteFormat, toAppwriteFormat } from '../../src/lib/syncMapping';
import { bucketTaskLinksSchema } from '../../src/db/schema';
import { MOSAIC_TABLES } from '../../infrastructure/mosaic-backend.mjs';
import { ACCOUNT_ERASURE_POLICY } from '../../infrastructure/account-erasure-policy.mjs';
import { migrateBucketTaskLinksBackend } from '../../scripts/migrate-bucket-task-links.mjs';

const createdAt = '2026-10-11T00:00:00.000Z';
const relation = {
  id: makeBucketTaskLinkId('owner_A', 'dream_A', 'task_A'),
  userId: 'owner_A', bucketListId: 'dream_A', taskId: 'task_A',
  createdAt, updatedAt: createdAt, isDeleted: false,
};

describe('private linked aspiration contract', () => {
  it('uses a stable short Appwrite-safe identity that does not depend on task category/date', () => {
    expect(relation.id).toMatch(/^[a-zA-Z0-9_]{1,36}$/);
    expect(makeBucketTaskLinkId('owner_A','dream_A','task_A')).toBe(relation.id);
    expect(makeBucketTaskLinkId('owner_B','dream_A','task_A')).not.toBe(relation.id);
    expect(makeBucketTaskLinkId('owner_A','dream_B','task_A')).not.toBe(relation.id);
    expect(makeBucketTaskLinkId('owner_A','dream_A','task_B')).not.toBe(relation.id);
  });

  it('maps only private owner/IDs and does not write task/category/social data', () => {
    const row = toAppwriteFormat(relation,'bucketTaskLinks',relation.userId);
    expect(row).toEqual({
      user_id:'owner_A',bucket_list_id:'dream_A',task_id:'task_A',
      created_at:createdAt,updated_at:createdAt,deleted:false,
    });
    expect(row).not.toHaveProperty('category_id');
    expect(row).not.toHaveProperty('visibility');
    expect(row).not.toHaveProperty('title');
    expect(row).not.toHaveProperty('date');
    expect(fromAppwriteFormat({ ...row,$id:relation.id },'bucketTaskLinks')).toMatchObject(relation);
    expect(bucketTaskLinksSchema.required).toContain('taskId');
  });

  it('has independent row-security, owner-scoped indexes, GC and erasure coverage', () => {
    const table = MOSAIC_TABLES.find(t=>t.id==='bucket_task_links');
    expect(table?.rowSecurity).toBe(true);
    expect(table?.permissions).toEqual(['create("users")']);
    expect(table?.indexes.map(i=>i.key)).toEqual([
      'idx_bucket_task_owner_updated','idx_bucket_task_owner_goal','idx_bucket_task_owner_task',
    ]);
    expect(ACCOUNT_ERASURE_POLICY.tables.bucket_task_links).toEqual({kind:'owned',ownerField:'user_id'});
  });

  it('rejects permission drift without making a remote write', async () => {
    const manifest=MOSAIC_TABLES.find(t=>t.id==='bucket_task_links')!;
    const request=vi.fn().mockResolvedValue({
      ...manifest,$id:manifest.id,rowSecurity:false,
    });
    await expect(migrateBucketTaskLinksBackend({request})).rejects.toThrow(/permission drift/i);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('creates only the additive table when missing', async () => {
    const request=vi.fn(async (method:string)=>{
      if(method==='GET') throw Object.assign(new Error('missing'),{status:404});
      return {};
    });
    await expect(migrateBucketTaskLinksBackend({request})).resolves.toEqual({created:true});
    expect(request).toHaveBeenCalledWith('POST',expect.any(String),expect.objectContaining({
      tableId:'bucket_task_links',rowSecurity:true,permissions:['create("users")'],
    }));
  });
});
