import { describe, expect, it, vi } from 'vitest';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import {
  APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, APPWRITE_TABLES,
} from '../../src/lib/appwriteConfig';
import {
  readFrozenAppwriteOwnerHistory, type SourceLease,
  type AppwriteHistoryReadOptions,
} from '../../supabase-poc/appwriteOwnerHistoryRead';

const owner: CandidateIdentity = {
  legacyUserId: 'legacy_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const foreign = 'legacy_foreign';
const timestamp = '2026-10-25T11:00:00Z';
const fullTask = (id: string, deleted = false) => ({
  $id: id, user_id: owner.legacyUserId, deleted, title: 'not-a-task-export',
});
const fullBucket = (id: string, deleted = false) => ({
  $id: id, user_id: owner.legacyUserId, deleted, title: 'Dream',
  description: '', achieved: false, achieved_at: '',
  created_at: timestamp, updated_at: timestamp,
});
const fullLink = (id: string, taskId: string, deleted = false) => ({
  $id: id, user_id: owner.legacyUserId, deleted,
  bucket_list_id: 'goal_1', task_id: taskId,
  created_at: timestamp, updated_at: timestamp,
});
const sourceTarget = APPWRITE_ENDPOINT + '|' + APPWRITE_PROJECT_ID +
  '|' + APPWRITE_DATABASE_ID + '|cloud-source-fixture';
const lease: SourceLease = {
  ownerId: owner.legacyUserId, sourceDeploymentId: sourceTarget,
  leaseId: 'external_frozen_read_lease',
  generation: 'generation_17', expiresAt: '2999-01-01T00:00:00Z',
  readOnly: true,
  ownerCounts: { tasks: 3, buckets: 1, links: 2 },
};
type Raw = Record<string, unknown>;
function harness() {
  const raw: Record<string, Raw[]> = {
    [APPWRITE_TABLES.tasks]: [
      fullTask('task_1'), fullTask('task_2', true), fullTask('task_3'),
    ],
    [APPWRITE_TABLES.bucketList]: [fullBucket('goal_1')],
    [APPWRITE_TABLES.bucketTaskLinks]: [
      fullLink('link_1', 'task_1'),
      fullLink('link_2', 't'.repeat(255), true),
    ],
  };
  let accountId = owner.legacyUserId;
  let epoch = 7;
  let currentLease: SourceLease = { ...lease };
  const calls: Array<{ tableId: string; queries: unknown[]; total: true }> = [];
  const getAccount = vi.fn(async () => ({ $id: accountId }));
  const getSessionEpoch = vi.fn(async () => epoch);
  const getSourceLease = vi.fn(async () => ({
    ...currentLease, ownerCounts: { ...currentLease.ownerCounts },
  }));
  const listRows = vi.fn(async (request: {
    databaseId: string; tableId: string; queries: string[]; total: true;
  }) => {
    const queries = request.queries.map(query => JSON.parse(query));
    calls.push({ tableId: request.tableId, queries, total: request.total });
    const after = queries.find(q => q.method === 'cursorAfter')?.values?.[0] as string | undefined;
    const limit = queries.find(q => q.method === 'limit')?.values?.[0] as number;
    const rows = raw[request.tableId];
    const remaining = rows.filter(row => !after || String(row.$id) > after);
    return { total: rows.length, rows: remaining.slice(0, limit) };
  });
  const options: AppwriteHistoryReadOptions = {
    identity: owner, sourceDeploymentId: 'cloud-source-fixture',
    getAccount, getSessionEpoch, getSourceLease, listRows, pageSize: 2,
  };
  return {
    raw, calls, options, getAccount, getSessionEpoch, getSourceLease, listRows,
    changeAccount: () => { accountId = foreign; },
    changeEpoch: () => { epoch++; },
    changeLease: () => { currentLease = { ...lease, generation: 'generation_18' }; },
    expireLease: () => { currentLease = { ...lease, expiresAt: '2000-01-01T00:00:00Z' }; },
  };
}
describe('read-only frozen owner source history for Appwrite cloud/oracle (#1027)', () => {
  it('collects two complete signed passes, tombstones and untouched 255-char link IDs', async () => {
    const h = harness();
    const result = await readFrozenAppwriteOwnerHistory(h.options);
    expect(result.owner).toEqual(owner);
    expect(result.sourceDeploymentId).toBe(sourceTarget);
    expect(result.expectedCounts).toEqual({ tasks: 3, buckets: 1, links: 2 });
    expect(result.tasks).toEqual([
      { id: 'task_1', userId: owner.legacyUserId, isDeleted: false },
      { id: 'task_2', userId: owner.legacyUserId, isDeleted: true },
      { id: 'task_3', userId: owner.legacyUserId, isDeleted: false },
    ]);
    expect(result.buckets[0]).toMatchObject({
      id: 'goal_1', title: 'Dream', userId: owner.legacyUserId, isDeleted: false,
    });
    expect(result.links[1]).toMatchObject({
      id: 'link_2', isDeleted: true, taskId: 't'.repeat(255),
    });
    expect(result.fingerprints.tasks).toMatch(/^[a-f0-9]{64}$/);
    expect(h.calls.filter(x => x.tableId === APPWRITE_TABLES.tasks)).toHaveLength(4);
    for (const call of h.calls) {
      expect(call.total).toBe(true);
      expect(call.queries).toEqual(expect.arrayContaining([
        { method: 'equal', attribute: 'user_id', values: [owner.legacyUserId] },
        { method: 'orderAsc', attribute: '$id' },
      ]));
    }
    expect(h.calls.every(x => x.queries.some(q =>
      (q as { method: string }).method === 'equal'))).toBe(true);
    expect(h.getAccount.mock.calls.length).toBeGreaterThan(12);
    expect(h.getSourceLease.mock.calls.length).toBeGreaterThan(12);
  });

  it('rejects foreign owner row despite filtered server list', async () => {
    const h = harness();
    h.raw[APPWRITE_TABLES.bucketTaskLinks][0].user_id = foreign;
    await expect(readFrozenAppwriteOwnerHistory(h.options)).rejects.toThrow(/foreign/);
  });
  it('detects signed account switch during listing, not just before and after total scan', async () => {
    const h = harness();
    h.listRows.mockImplementationOnce(async () => {
      h.changeAccount();
      return { rows: [fullTask('task_1')], total: 3 };
    });
    await expect(readFrozenAppwriteOwnerHistory(h.options)).rejects.toThrow(/account\/session switched/);
  });
  it('detects local auth generation change even with same Appwrite owner ID', async () => {
    const h = harness();
    h.listRows.mockImplementationOnce(async () => {
      h.changeEpoch();
      return { rows: [fullTask('task_1')], total: 3 };
    });
    await expect(readFrozenAppwriteOwnerHistory(h.options)).rejects.toThrow(/account\/session switched/);
  });
  it('rejects expiring or replaced source server writer lease between pages', async () => {
    for (const action of ['changeLease', 'expireLease'] as const) {
      const h = harness();
      h.listRows.mockImplementationOnce(async () => {
        h[action]();
        return { rows: [fullTask('task_1')], total: 3 };
      });
      await expect(readFrozenAppwriteOwnerHistory(h.options)).rejects.toThrow(/fence changed or expired/);
    }
  });
  it('refuses fake source installation, invalid signed identity, and missing trusted fence', async () => {
    const h = harness();
    await expect(readFrozenAppwriteOwnerHistory({
      ...h.options, sourceDeploymentId: 'other-deployment',
    })).rejects.toThrow(/fence/);
    expect(h.listRows).not.toHaveBeenCalled();
    await expect(readFrozenAppwriteOwnerHistory({
      ...h.options, getSourceLease: undefined as never,
    })).rejects.toThrow(/trusted/);
    await expect(readFrozenAppwriteOwnerHistory({
      ...h.options, identity: { ...owner, supabaseUserId: 'forged' },
    })).rejects.toThrow();
    expect(h.listRows).not.toHaveBeenCalled();
  });
  it('rejects omitted and duplicated remote rows, never silently treats them as absent', async () => {
    const missing = harness();
    missing.listRows.mockResolvedValueOnce({ rows: [fullTask('task_1')], total: 3 });
    await expect(readFrozenAppwriteOwnerHistory(missing.options))
      .rejects.toThrow(/Incomplete owner history pagination/);
    const duplicated = harness();
    duplicated.listRows.mockResolvedValueOnce({
      rows: [fullTask('task_1'), fullTask('task_1')], total: 3,
    });
    await expect(readFrozenAppwriteOwnerHistory(duplicated.options))
      .rejects.toThrow(/Duplicate|cursor/);
  });
  it('requires an independent authoritative frozen owner count, not merely an Appwrite list total', async () => {
    const hidden = harness();
    hidden.listRows.mockResolvedValueOnce({
      rows: [fullTask('task_1'), fullTask('task_2')], total: 2,
    });
    await expect(readFrozenAppwriteOwnerHistory(hidden.options))
      .rejects.toThrow(/trusted frozen source row count/);
    const forged = harness();
    forged.getSourceLease.mockResolvedValueOnce({
      ...lease, ownerCounts: { tasks: 2, buckets: 1, links: 2 },
    });
    await expect(readFrozenAppwriteOwnerHistory(forged.options))
      .rejects.toThrow(/fence changed or expired/);
  });
  it('rejects inconsistent totals and malformed tombstones', async () => {
    const total = harness();
    total.listRows.mockResolvedValueOnce({
      rows: [fullTask('task_1'), fullTask('task_2')], total: 4,
    }).mockResolvedValueOnce({ rows: [fullTask('task_3')], total: 3 });
    await expect(readFrozenAppwriteOwnerHistory(total.options))
      .rejects.toThrow(/changing signed Appwrite owner history total/);
    const invalid = harness();
    delete invalid.raw[APPWRITE_TABLES.tasks][0].deleted;
    await expect(readFrozenAppwriteOwnerHistory(invalid.options))
      .rejects.toThrow(/tombstone state/);
  });
  it('rejects unchanged counts with changed original link references in a second complete pass', async () => {
    const h = harness();
    let linkPages = 0;
    h.listRows.mockImplementation(async (request) => {
      const queries = request.queries.map(query => JSON.parse(query));
      const after = queries.find(q => q.method === 'cursorAfter')?.values?.[0] as string | undefined;
      const limit = queries.find(q => q.method === 'limit')?.values?.[0] as number;
      if (request.tableId === APPWRITE_TABLES.bucketTaskLinks && ++linkPages === 2)
        h.raw[APPWRITE_TABLES.bucketTaskLinks][1].task_id = 'task_changed';
      const rows = h.raw[request.tableId];
      return { total: rows.length, rows: rows.filter(x => !after || String(x.$id) > after).slice(0,limit) };
    });
    await expect(readFrozenAppwriteOwnerHistory(h.options))
      .rejects.toThrow(/changed between complete passes/);
  });
  it('rejects signed pages that move cursor backward or exceed bounded maximum', async () => {
    const back = harness();
    back.listRows.mockResolvedValueOnce({ rows: [fullTask('task_2'), fullTask('task_1')], total: 3 });
    await expect(readFrozenAppwriteOwnerHistory(back.options)).rejects.toThrow(/out-of-order/);
    const cap = harness();
    cap.listRows.mockResolvedValueOnce({ rows: [], total: 250001 });
    await expect(readFrozenAppwriteOwnerHistory(cap.options)).rejects.toThrow(/history total/);
    await expect(readFrozenAppwriteOwnerHistory({
      ...cap.options, pageSize: 101,
    })).rejects.toThrow(/page size/);
  });
});
