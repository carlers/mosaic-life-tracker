import { describe, expect, it, vi } from 'vitest';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { PersonalSourceLease } from '../../supabase-poc/appwritePersonalSourceRead';
import { readFrozenAppwritePersonalSource } from '../../supabase-poc/appwritePersonalSourceRead';
import {
  APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, APPWRITE_TABLES,
} from '../../src/lib/appwriteConfig';

const owner: CandidateIdentity = {
  legacyUserId: 'legacy_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const foreign = 'other_owner';
const when = '2026-10-25T11:00:00Z';
const deployment = [APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID, 'synthetic-cloud'].join('|');
const baseLease: PersonalSourceLease = {
  ownerId: owner.legacyUserId, sourceDeploymentId: deployment,
  readOnly: true, leaseId: 'source_fenced_lease_9', generation: 'generation_17',
  expiresAt: '2999-01-01T00:00:00Z',
  ownerCounts: { tasks: 3, buckets: 2, links: 2 },
  personalCounts: { tasks: 3, categories: 2, diary: 1, settings: 2 },
};
type Remote = Record<string, unknown>;
function remote(id: string, fields: Remote, deleted = false): Remote {
  return {
    $id: id, user_id: owner.legacyUserId, deleted,
    $createdAt: when, $updatedAt: when,
    $permissions: ['read("user:legacy_owner")'],
    ...fields,
  };
}
const tasks = [
  remote('task_1', {
    title: 'My full task', is_completed: false, category_id: 'cat_1',
    order: 1, date: '2026-10-25', memo: 'Private original text',
    image: 'source-file-id', created_at: when, updated_at: when,
    visibility: 'private',
  }),
  remote('task_2', {
    title: 'Deleted historical task', is_completed: true, category_id: 'cat_2',
    order: 2, date: '2026-10-24', memo: null, created_at: when,
    updated_at: when, visibility: 'private',
  }, true),
  remote('task_3', {
    title: 'Legacy optional columns', is_completed: false, category_id: '',
    order: 3, date: '2026-10-23', tags: null, created_at: when, updated_at: when,
  }),
];
const categories = [
  remote('cat_1', { name: 'Personal', color: '#fff', order: 0,
    visibility: 'private', updated_at: when }),
  remote('cat_2', { name: 'Retired', color: '#000', order: 1,
    visibility: 'private', icon: null, updated_at: when }, true),
];
const diary = [
  remote('diary_1', { date: '2026-10-25', content: 'Exact private entry',
    emoji: '🌻', photos: '["photo_1","photo_2"]',
    visibility: 'private', created_at: when, updated_at: when }),
];
const settings = [
  remote('pref_1', { key: 'theme', value: '{"mode":"dark"}', updated_at: when }),
  remote('pref_2', { key: 'profileImageId', value: 'appwrite-image-ref', updated_at: when }, true),
];

function harness() {
  const raw: Record<string, Remote[]> = {
    [APPWRITE_TABLES.tasks]: structuredClone(tasks),
    [APPWRITE_TABLES.categories]: structuredClone(categories),
    [APPWRITE_TABLES.diary]: structuredClone(diary),
    [APPWRITE_TABLES.settings]: structuredClone(settings),
  };
  let currentAccount = owner.legacyUserId;
  let epoch = 3;
  let currentLease: PersonalSourceLease = structuredClone(baseLease);
  const queries: Array<{ tableId: string; query: Array<{ method: string; values?: unknown[] }> }> = [];
  const getAccount = vi.fn(async () => ({ $id: currentAccount }));
  const getSessionEpoch = vi.fn(async () => epoch);
  const getSourceLease = vi.fn(async () => structuredClone(currentLease));
  const listRows = vi.fn(async (request: {
    databaseId: string; tableId: string; queries: string[]; total: true;
  }) => {
    const query = request.queries.map(q => JSON.parse(q)) as
      Array<{ method: string; values?: unknown[] }>;
    queries.push({ tableId: request.tableId, query });
    const cursor = query.find(q => q.method === 'cursorAfter')?.values?.[0];
    const limit = query.find(q => q.method === 'limit')?.values?.[0] as number;
    const rows = raw[request.tableId];
    return {
      total: rows.length,
      rows: rows.filter(row => !cursor || String(row.$id) > String(cursor)).slice(0, limit),
    };
  });
  return {
    raw, queries, listRows, getAccount, getSessionEpoch, getSourceLease,
    options: {
      identity: owner, sourceDeploymentId: 'synthetic-cloud', pageSize: 2,
      getAccount, getSessionEpoch, getSourceLease, listRows,
    },
    changeAccount: () => { currentAccount = foreign; },
    changeEpoch: () => { epoch++; },
    changeLease: () => { currentLease = { ...currentLease, generation: 'generation_18' }; },
    changeCounts: () => { currentLease.personalCounts.tasks = 2; },
    expire: () => { currentLease.expiresAt = '2000-01-01T00:00:00Z'; },
  };
}
describe('frozen signed personal Appwrite source readback (#1027)', () => {
  it('preserves full task/Diary/settings fields, tombstones, nulls and image references', async () => {
    const h = harness();
    const data = await readFrozenAppwritePersonalSource(h.options);
    expect(data.rows.tasks).toHaveLength(3);
    expect(data.rows.tasks[0].columns).toMatchObject({
      title: 'My full task', memo: 'Private original text', image: 'source-file-id',
    });
    expect(data.rows.tasks[1]).toMatchObject({
      id: 'task_2', isDeleted: true, columns: { memo: null },
    });
    expect(data.rows.tasks[2].columns).not.toHaveProperty('memo');
    expect(data.rows.categories[1]).toMatchObject({
      id: 'cat_2', isDeleted: true, columns: { icon: null },
    });
    expect(data.rows.diary[0].columns.photos).toBe('["photo_1","photo_2"]');
    expect(data.rows.settings[1]).toMatchObject({
      isDeleted: true, columns: { key: 'profileImageId', value: 'appwrite-image-ref' },
    });
    expect(data.rows.tasks[0].originalPermissions).toEqual(['read("user:legacy_owner")']);
    expect(data.rows.tasks[0].serverCreatedAt).toBe(when);
    expect(data.originalOwnerCounts).toEqual(baseLease.personalCounts);
    expect(data.sourceOwnerCounts).toEqual(baseLease.ownerCounts);
    expect(data.fingerprintSha256.settings).toMatch(/^[a-f0-9]{64}$/);
    expect(data.scanSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(data.completeSourceArchive).toBe(false);
    expect(data.providerCutoverEligible).toBe(false);
    expect(h.listRows).toHaveBeenCalledTimes(10);
    for (const { query } of h.queries) {
      expect(query).toEqual(expect.arrayContaining([
        { method: 'equal', attribute: 'user_id', values: [owner.legacyUserId] },
        { method: 'orderAsc', attribute: '$id' },
      ]));
    }
  });
  it('is deterministic despite Appwrite JSON field-order variation between signed passes', async () => {
    const h = harness();
    const existing = h.listRows.getMockImplementation()!;
    let passes = 0;
    h.listRows.mockImplementation(async request => {
      passes++;
      if (passes > 5) {
        h.raw[APPWRITE_TABLES.tasks] = h.raw[APPWRITE_TABLES.tasks].map(row =>
          Object.fromEntries(Object.entries(row).reverse()));
      }
      return existing(request);
    });
    const data = await readFrozenAppwritePersonalSource(h.options);
    expect(data.originalOwnerCounts.tasks).toBe(3);
  });
  it('rejects a changed memo or photo reference with unchanged owner total on second pass', async () => {
    for (const [table, field] of [
      [APPWRITE_TABLES.tasks, 'memo'],
      [APPWRITE_TABLES.diary, 'photos'],
    ] as const) {
      const h = harness();
      const original = h.listRows.getMockImplementation()!;
      let count = 0;
      h.listRows.mockImplementation(async request => {
        if (request.tableId === table && ++count === 2)
          h.raw[table][0][field] = 'changed-after-frozen';
        return original(request);
      });
      await expect(readFrozenAppwritePersonalSource(h.options))
        .rejects.toThrow(/content changed across complete frozen source passes/);
    }
  });
  it('rejects foreign-owned rows despite owner-filtered signed request', async () => {
    const h = harness();
    h.raw[APPWRITE_TABLES.settings][0].user_id = foreign;
    await expect(readFrozenAppwritePersonalSource(h.options))
      .rejects.toThrow(/Foreign/);
  });
  it('rejects changed account, epoch or server writer generation during any page', async () => {
    for (const action of ['changeAccount', 'changeEpoch', 'changeLease', 'expire'] as const) {
      const h = harness();
      h.listRows.mockImplementationOnce(async () => {
        h[action]();
        return { total: 3, rows: h.raw[APPWRITE_TABLES.tasks].slice(0, 2) };
      });
      await expect(readFrozenAppwritePersonalSource(h.options))
        .rejects.toThrow(/session changed|lease changed or expired/);
    }
  });
  it('rejects a malicious or incomplete independent frozen row-count witness', async () => {
    const h = harness();
    h.changeCounts();
    await expect(readFrozenAppwritePersonalSource(h.options))
      .rejects.toThrow(/Inconsistent task owner counts/);
    const missing = harness();
    missing.listRows.mockResolvedValueOnce({ total: 2,
      rows: missing.raw[APPWRITE_TABLES.tasks].slice(0, 2) });
    await expect(readFrozenAppwritePersonalSource(missing.options))
      .rejects.toThrow(/Incomplete frozen Appwrite personal source total/);
    const invalid = harness();
    invalid.getSourceLease.mockResolvedValueOnce({
      ...baseLease, personalCounts: { ...baseLease.personalCounts, diary: -1 },
    });
    await expect(readFrozenAppwritePersonalSource(invalid.options))
      .rejects.toThrow(/independently frozen complete owner counts/);
  });
  it('rejects duplicate cursor pages, descending rows and partial pages', async () => {
    const duplicate = harness();
    duplicate.listRows.mockResolvedValueOnce({
      total: 3, rows: [duplicate.raw[APPWRITE_TABLES.tasks][0],
        duplicate.raw[APPWRITE_TABLES.tasks][0]],
    });
    await expect(readFrozenAppwritePersonalSource(duplicate.options))
      .rejects.toThrow(/cursor/);
    const outOfOrder = harness();
    outOfOrder.listRows.mockResolvedValueOnce({
      total: 3, rows: [outOfOrder.raw[APPWRITE_TABLES.tasks][1],
        outOfOrder.raw[APPWRITE_TABLES.tasks][0]],
    });
    await expect(readFrozenAppwritePersonalSource(outOfOrder.options))
      .rejects.toThrow(/cursor/);
    const partial = harness();
    partial.listRows.mockResolvedValueOnce({
      total: 3, rows: partial.raw[APPWRITE_TABLES.tasks].slice(0, 1),
    });
    await expect(readFrozenAppwritePersonalSource(partial.options))
      .rejects.toThrow(/pagination/);
  });
  it('refuses unknown source fields rather than silently deleting them', async () => {
    const h = harness();
    h.raw[APPWRITE_TABLES.diary][0].unmigrated_new_field = 'important';
    await expect(readFrozenAppwritePersonalSource(h.options))
      .rejects.toThrow(/Unknown Appwrite personal source field/);
  });
  it('rejects nested, nonfinite and excessively large source values', async () => {
    for (const value of [{ secret: 'nested' }, Infinity, 'x'.repeat(1_000_001)]) {
      const h = harness();
      h.raw[APPWRITE_TABLES.settings][0].value = value;
      await expect(readFrozenAppwritePersonalSource(h.options))
        .rejects.toThrow(/Unsupported nested|Oversized/);
    }
  });
  it('refuses unsigned account mapping, wrong deployment and missing server freeze', async () => {
    const h = harness();
    await expect(readFrozenAppwritePersonalSource({
      ...h.options, identity: { ...owner, supabaseUserId: 'fake' },
    })).rejects.toThrow();
    await expect(readFrozenAppwritePersonalSource({
      ...h.options, sourceDeploymentId: 'oracle-source',
    })).rejects.toThrow(/lease changed/);
    await expect(readFrozenAppwritePersonalSource({
      ...h.options, getSourceLease: undefined as never,
    })).rejects.toThrow(/read-only lease/);
    expect(h.listRows).not.toHaveBeenCalled();
  });
  it('rejects malformed original Appwrite server permission metadata and timestamps', async () => {
    const h = harness();
    h.raw[APPWRITE_TABLES.tasks][0].$permissions = [null];
    await expect(readFrozenAppwritePersonalSource(h.options))
      .rejects.toThrow(/permission metadata/);
    const t = harness();
    t.raw[APPWRITE_TABLES.tasks][0].$updatedAt = 'not-a-date';
    await expect(readFrozenAppwritePersonalSource(t.options))
      .rejects.toThrow(/server timestamp/);
  });
  it('never starts a source scan if personal and historical task owner counts disagree', async () => {
    const h = harness();
    h.getSourceLease.mockResolvedValue({
      ...baseLease, ownerCounts: { ...baseLease.ownerCounts, tasks: 2 },
    });
    await expect(readFrozenAppwritePersonalSource(h.options))
      .rejects.toThrow(/Inconsistent task owner counts/);
    expect(h.listRows).not.toHaveBeenCalled();
  });
});
