import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AppwriteHistoryReadback } from '../../supabase-poc/appwriteOwnerHistoryRead';
import type {
  FrozenPersonalSnapshot, FrozenPersonalRow,
} from '../../supabase-poc/appwritePersonalSourceRead';
import { joinFrozenAppwriteOwnerSources } from '../../supabase-poc/appwriteFrozenPersonalJoin';

const id = { legacyUserId: 'owner_1',
  supabaseUserId: '11111111-1111-4111-8111-111111111111' };
const sourceDeploymentId = 'https://sgp.cloud.appwrite.io/v1|project|database|cloud';
const when = '2026-10-26T00:00:00Z';
const sha = (obj: unknown) =>
  createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
function rowHash(rows: unknown[]) {
  const hash = createHash('sha256');
  for (const row of rows) {
    const json = JSON.stringify(row);
    hash.update(Buffer.byteLength(json,'utf8').toString(10) + ':');
    hash.update(json,'utf8');
  }
  return hash.digest('hex');
}
const row = (idValue: string, isDeleted = false,
  columns: Record<string, string | number | boolean | null> = {}): FrozenPersonalRow => ({
  id: idValue, userId: id.legacyUserId, isDeleted, columns,
  serverCreatedAt: when, serverUpdatedAt: when,
  originalPermissions: ['read("user:owner_1")'],
});
const taskHistory = [
  { id: 'task_1', userId: id.legacyUserId, isDeleted: false },
  { id: 'task_2', userId: id.legacyUserId, isDeleted: true },
];
const bucket = {
  id: 'goal_1', userId: id.legacyUserId, isDeleted: false,
  title: 'Private dream', description: '', achieved: false, achievedAt: '',
  createdAt: when, updatedAt: when,
};
const link = {
  id: 'link_1', userId: id.legacyUserId, isDeleted: false,
  bucketListId: 'goal_1', taskId: 'task_1',
  createdAt: when, updatedAt: when,
};

function fixtures() {
  const rows: FrozenPersonalSnapshot['rows'] = {
    tasks: [
      row('task_1', false, { title: 'My private memo', memo: 'A', image: 'file_1' }),
      row('task_2', true, { title: 'Old deleted task', memo: null }),
    ],
    categories: [row('cat_1', false, { name: 'Private' })],
    diary: [row('diary_1', false, {
      content: 'Dear diary', photos: '["private_photo_1"]',
    })],
    settings: [row('setting_1', false, {
      key: 'profileImageId', value: 'appwrite_legacy_avatar',
    })],
  };
  const fingerprintSha256 = {
    tasks: rowHash(rows.tasks), categories: rowHash(rows.categories),
    diary: rowHash(rows.diary), settings: rowHash(rows.settings),
  };
  const originalOwnerCounts = { tasks: 2, categories: 1, diary: 1, settings: 1 };
  const sourceOwnerCounts = { tasks: 2, buckets: 1, links: 1 };
  const personal: FrozenPersonalSnapshot = {
    identity: { ...id }, sourceDeploymentId, leaseId: 'frozen_lease_1',
    generation: 'generation_9',
    originalOwnerCounts, sourceOwnerCounts, fingerprintSha256, rows,
    scanSha256: sha({deployment: sourceDeploymentId, owner: id.legacyUserId,
      generation: 'generation_9', originalOwnerCounts,
      sourceOwnerCounts, fingerprintSha256 }),
    completeSourceArchive: false, providerCutoverEligible: false,
  };
  const history: AppwriteHistoryReadback = {
    owner: { ...id }, sourceDeploymentId, leaseId: 'frozen_lease_1',
    generation: 'generation_9',
    tasks: structuredClone(taskHistory),
    buckets: [{ ...bucket }], links: [{ ...link }],
    expectedCounts: { tasks: 2, buckets: 1, links: 1 },
    fingerprints: {
      tasks: rowHash(taskHistory), buckets: rowHash([bucket]), links: rowHash([link]),
    },
  };
  return { personal, history };
}
describe('same frozen source lease across seven pre-social owner domains (#1027)', () => {
  it('joins exact owner identities and tombstones without declaring an authenticated archive', () => {
    const value = joinFrozenAppwriteOwnerSources(fixtures());
    expect(value.counts).toEqual({
      tasks: 2, categories: 1, diary: 1, settings: 1, buckets: 1, links: 1,
    });
    expect(value.taskIdentitySha256).toBe(rowHash(taskHistory));
    expect(value.sevenDomainScanSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(value.fullEncryptedSourceAuthenticated).toBe(false);
    expect(value.providerCutoverEligible).toBe(false);
  });
  it('rejects mixing Appwrite Cloud with Oracle or different frozen lease generations', () => {
    for (const field of ['sourceDeploymentId', 'leaseId', 'generation'] as const) {
      const value = fixtures();
      value.history[field] = 'different_installed_source';
      expect(() => joinFrozenAppwriteOwnerSources(value))
        .toThrow(/installation or frozen lease mismatch/);
    }
  });
  it('rejects a second Supabase owner UUID sharing the same legacy account ID', () => {
    const value = fixtures();
    value.history.owner.supabaseUserId = '22222222-2222-4222-8222-222222222222';
    expect(() => joinFrozenAppwriteOwnerSources(value)).toThrow(/identity mapping/);
  });
  it('rejects an old task tombstone quietly changed in the full-content source', () => {
    const value = fixtures();
    value.personal.rows.tasks[1].isDeleted = false;
    expect(() => joinFrozenAppwriteOwnerSources(value))
      .toThrow(/content changed after signed readback/);
  });
  it('rejects a consistent local task hash but a different frozen historical task identity', () => {
    const value = fixtures();
    value.history.tasks[1].isDeleted = false;
    value.history.fingerprints.tasks = rowHash(value.history.tasks);
    expect(() => joinFrozenAppwriteOwnerSources(value))
      .toThrow(/identity\/tombstone mismatch/);
  });
  it('rejects same-count task substitution in historical readback', () => {
    const value = fixtures();
    value.history.tasks[1].id = 'task_3';
    value.history.fingerprints.tasks = rowHash(value.history.tasks);
    expect(() => joinFrozenAppwriteOwnerSources(value))
      .toThrow(/identity\/tombstone mismatch/);
  });
  it('detects changes to raw Diary photo refs, private settings and source permissions', () => {
    const cases = [
      (x: ReturnType<typeof fixtures>) => { x.personal.rows.diary[0].columns.photos = '[]'; },
      (x: ReturnType<typeof fixtures>) => { x.personal.rows.settings[0].columns.value = 'reset'; },
      (x: ReturnType<typeof fixtures>) => { x.personal.rows.tasks[0].originalPermissions = []; },
    ];
    for (const change of cases) {
      const value = fixtures();
      change(value);
      expect(() => joinFrozenAppwriteOwnerSources(value))
        .toThrow(/content changed after signed readback/);
    }
  });
  it('rejects extra or omitted frozen categories even when their fingerprint is modified', () => {
    const x = fixtures();
    x.personal.rows.categories = [];
    x.personal.fingerprintSha256.categories = rowHash([]);
    expect(() => joinFrozenAppwriteOwnerSources(x)).toThrow(/count mismatch/);
  });
  it('rejects a forged historical Bucket/link or foreign-owned linked task', () => {
    const one = fixtures();
    one.history.links[0].taskId = 'task_2';
    expect(() => joinFrozenAppwriteOwnerSources(one))
      .toThrow(/historical source changed/);
    const two = fixtures();
    two.history.links[0].userId = 'foreign_owner';
    two.history.fingerprints.links = rowHash(two.history.links);
    expect(() => joinFrozenAppwriteOwnerSources(two)).toThrow(/Foreign/);
  });
  it('rejects a post-scan original permission, count or summary checksum replacement', () => {
    const p = fixtures();
    p.personal.sourceOwnerCounts.links = 2;
    expect(() => joinFrozenAppwriteOwnerSources(p)).toThrow(/count mismatch/);
    const q = fixtures();
    q.personal.scanSha256 = '0'.repeat(64);
    expect(() => joinFrozenAppwriteOwnerSources(q)).toThrow(/summary checksum/);
  });
  it('rejects out-of-order and duplicated owner rows despite matching count witnesses', () => {
    const a = fixtures();
    a.personal.rows.tasks.reverse();
    a.personal.fingerprintSha256.tasks = rowHash(a.personal.rows.tasks);
    expect(() => joinFrozenAppwriteOwnerSources(a)).toThrow(/unsorted/);
    const b = fixtures();
    b.history.tasks[1].id = b.history.tasks[0].id;
    b.history.fingerprints.tasks = rowHash(b.history.tasks);
    expect(() => joinFrozenAppwriteOwnerSources(b)).toThrow(/duplicate/);
  });
  it('never mistakes a client-side byte fingerprint for an authenticated full source archive', () => {
    const x = fixtures();
    x.personal.completeSourceArchive = true as never;
    expect(() => joinFrozenAppwriteOwnerSources(x))
      .toThrow(/separately fenced preliminary snapshots/);
  });
});
