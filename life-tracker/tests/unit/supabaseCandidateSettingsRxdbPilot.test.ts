import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsDocument } from '../../src/db/schema';
import { createCandidateRxdbPilot, CandidatePendingConflictError } from '../../supabase-poc/candidateRxdbPilot';
import { CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';
import { toCandidateSettingWrite, type CandidateSettingRow } from '../../supabase-poc/candidateSettingsMapping';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';

const { replicate } = vi.hoisted(() => ({ replicate: vi.fn() }));
vi.mock('rxdb/plugins/replication', () => ({ replicateRxCollection: replicate }));
const alice: CandidateIdentity = {
  legacyUserId: 'legacy_alice',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const bob = { ...alice, legacyUserId: 'legacy_bob',
  supabaseUserId: '22222222-2222-4222-8222-222222222222' };
const initial: SettingsDocument & { _deleted: false } = {
  id: 's_123', userId: alice.legacyUserId, key: 'calendarZoomDays',
  value: '{"days":7,"emoji":"🌙"}', updatedAt: '2026-10-25T00:00:00Z',
  isDeleted: false, _deleted: false,
};
const changed = { ...initial, value: '5', updatedAt: '2026-10-25T01:00:00Z' };
function row(doc: SettingsDocument = initial, rev = '1'): CandidateSettingRow {
  return { ...toCandidateSettingWrite(doc, alice),
    change_seq: rev, server_updated_at: '2026-10-25T02:00:00Z' };
}
function harness(collection?: unknown) {
  const readSettingMaster = vi.fn<(id: string) => Promise<CandidateSettingRow | null>>()
    .mockResolvedValue(null);
  const createSetting = vi.fn().mockResolvedValue({
    state: 'created', row: row(), revision: '1',
  });
  const compareAndSet = vi.fn().mockResolvedValue({
    state: 'applied', row: row(changed, '2'), revision: '2',
  });
  const listChanges = vi.fn().mockResolvedValue([]);
  let current: { userId: string; accessToken: string; sessionEpoch: number } | null = {
    userId: alice.supabaseUserId, accessToken: 'signed-token', sessionEpoch: 1,
  };
  const getVerifiedSession = vi.fn(async () => current);
  const pilot = createCandidateRxdbPilot<SettingsDocument>({
    domain: 'settings', identity: alice,
    session: { getVerifiedSession },
    changes: { listChanges },
    writer: { readSettingMaster, createSetting } as never,
    cas: { compareAndSet } as never,
    collection: collection as never,
  });
  const push = (next = initial, assumed?: typeof initial) =>
    pilot.push([{ newDocumentState: next, assumedMasterState: assumed }] as never);
  return {
    pilot, push, readSettingMaster, createSetting, compareAndSet, listChanges,
    switchTo(id: string | null, epoch = 2) {
      current = id ? {userId:id, accessToken:'other-token', sessionEpoch:epoch} : null;
    },
  };
}
beforeEach(() => vi.clearAllMocks());

describe('source-only owner-private Settings native RxDB pilot (no live runtime)', () => {
  it('creates exactly the signed owner document and confirms opaque master', async () => {
    const h = harness();
    await expect(h.push()).resolves.toEqual([]);
    expect(h.createSetting).toHaveBeenCalledWith(initial, alice);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()).toEqual([]);
  });

  it('uses bigint server-revision CAS and excludes protected key/owner/id changes', async () => {
    const h = harness();
    h.readSettingMaster.mockResolvedValue(row(initial, '9007199254740993'));
    h.compareAndSet.mockResolvedValue({
      state:'applied', row:row(changed,'9007199254740994'),
      revision:'9007199254740994',
    });
    await expect(h.push(changed,initial)).resolves.toEqual([]);
    expect(h.compareAndSet).toHaveBeenCalledWith({
      domain:'settings', ownerId:alice.supabaseUserId, documentId:initial.id,
      expectedRevision:'9007199254740993',
      patch:{setting_value:'5',updated_at:changed.updatedAt,is_deleted:false},
    });
  });

  it('preserves signed pull tombstones and full bigint cursor without physical deletes', async () => {
    const h = harness();
    h.listChanges.mockResolvedValueOnce([{ ...row(initial,'9007199254740993'), is_deleted:true }]);
    await expect(h.pilot.pull(undefined,50)).resolves.toEqual({
      documents:[{...initial,isDeleted:true,_deleted:false}],
      checkpoint:{changeSeq:'9007199254740993'},
    });
    expect(h.listChanges).toHaveBeenCalledWith({
      domain:'settings',ownerId:alice.supabaseUserId,afterExclusive:'0',batchSize:50,
    });
    await expect(h.push({...initial,_deleted:true} as never)).rejects.toThrow(/Physical deletes/);
  });

  it('refuses settings key reassignment, retaining local draft and avoiding CAS', async () => {
    const h = harness();
    h.readSettingMaster.mockResolvedValue(row());
    const renamed = { ...initial,key:'newPortableKey' };
    await expect(h.push(renamed,initial)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.pilot.listPendingConflicts()).toMatchObject([{
      domain:'settings',documentId:initial.id,reason:'protected-field-change',
    }]);
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('parks divergent same-row values without a master base or guessing by timestamp', async () => {
    const h = harness();
    h.readSettingMaster.mockResolvedValue(row(initial,'7'));
    await expect(h.push(changed)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()[0].reason).toBe('divergent-master');
  });

  it('rejects provider-specific avatar/social keys rather than silently dropping data', async () => {
    const h=harness();
    for(const key of ['profileImageId','friend_carousel_prefs']) {
      await expect(h.push({...initial,key})).rejects.toThrow(/separate provider migration/);
    }
    expect(h.createSetting).not.toHaveBeenCalled();
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('does not read or mutate foreign cached owner settings', async () => {
    const h=harness();
    await expect(h.push({...initial,userId:bob.legacyUserId})).resolves.toEqual([]);
    expect(h.readSettingMaster).not.toHaveBeenCalled();
    expect(h.createSetting).not.toHaveBeenCalled();
    h.listChanges.mockResolvedValueOnce([{...row(),owner_id:bob.supabaseUserId}]);
    await expect(h.pilot.pull(undefined,20)).rejects.toThrow(/foreign owner/);
  });

  it('invalidates an in-flight signed session before acknowledging a create', async () => {
    const h=harness();
    h.createSetting.mockImplementationOnce(async () => {
      h.switchTo(bob.supabaseUserId);
      return {state:'created',row:row(),revision:'1'};
    });
    await expect(h.push()).rejects.toBeInstanceOf(CandidateAuthError);
  });

  it('explicitly audits local personal rows read-only with no cloud repair', async () => {
    const local={find:vi.fn(()=>({exec:async()=>[{toJSON:()=>initial}]}))};
    const h=harness(local);
    h.listChanges.mockResolvedValueOnce([row()]);
    await expect(h.pilot.verifyLocalReplica()).resolves.toMatchObject({
      rows:1,localChecked:1,localTotal:1,
    });
    expect(h.createSetting).not.toHaveBeenCalled();
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('does not start an RxDB writer automatically or touch the Appwrite runtime', () => {
    const h=harness();
    expect(replicate).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()).toEqual([]);
    expect(h.createSetting).not.toHaveBeenCalled();
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });
});
