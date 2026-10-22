import { describe, expect, it, vi } from 'vitest';
import { inspectSnapshot, parseAuditArgs } from '../../scripts/dr-readiness.mjs';

function fixture() {
  const contents = new Map([
    ['users', '{"id":"alpha"}\n{"id":"erased"}\n'],
    ['schema', '{"id":"tasks"}'],
    ['rows', [
      {id:'t1', data:{user_id:'alpha', deleted:true}},
      {id:'t2', data:{user_id:'erased', deleted:false}},
    ].map(x=>JSON.stringify(x)).join('\n')+'\n'],
    ['bucket', '{"id":"task_images"}'],
    ['files', JSON.stringify({permissions:['update("user:erased")']})+'\n'],
  ]);
  const readObject = vi.fn(async (key: string) => Buffer.from(contents.get(key) || ''));
  const manifest = {
    backupId:'20261018T110129330Z', completedAt:'2026-10-18T11:02:24.906Z',
    source:{projectId:'production123'},
    auth:{usersKey:'users'}, counts:{users:2,databases:1,tables:1,rows:2,buckets:1,files:1},
    databases:[{id:'life_tracker',tables:[{id:'tasks',schemaKey:'schema',rowsKey:'rows',rowCount:2}]}],
    storage:[{id:'task_images',configKey:'bucket',filesKey:'files',fileCount:1}],
  };
  return { manifest, readObject };
}

describe('read-only historic DR readiness audit', () => {
  it('rejects ambiguous or missing source constraints', () => {
    expect(() => parseAuditArgs([])).toThrow();
    expect(() => parseAuditArgs(['--snapshot','../../test','--expected-source','production123'])).toThrow();
    expect(parseAuditArgs(['--snapshot','20261018T110129330Z','--expected-source','production123']))
      .toMatchObject({source:'production123'});
  });

  it('rejects unexpected source before fetching private rows', async () => {
    const x = fixture();
    await expect(inspectSnapshot(x, new Set(), 'different123')).rejects.toThrow(/Source project mismatch/);
    expect(x.readObject).not.toHaveBeenCalled();
  });

  it('counts privacy deletions and preserves historical tombstones without outputting owner IDs', async () => {
    const x = fixture();
    const y = await inspectSnapshot(x, new Set(['erased']), 'production123', new Date('2026-10-22T12:00:00Z'));
    expect(y).toMatchObject({ archivedUsers:2, archivedUsersExcluded:1, archivedRows:2,
      retainedRows:1, filteredRows:1, archivedFiles:1, excludedFiles:1,
      sourceProjectVerified:true, readyForLiveMigration:false,
      meets36HourFreshness:false, fullFileContentIntegrityVerified:false });
    expect(JSON.stringify(y)).not.toMatch(/erased|alpha|production123/);
  });

  it('fails if authenticated manifest counts are inconsistent', async () => {
    const x = fixture();
    x.manifest.counts.rows = 9;
    await expect(inspectSnapshot(x, new Set(), 'production123')).rejects.toThrow(/count mismatch/);
  });
});
