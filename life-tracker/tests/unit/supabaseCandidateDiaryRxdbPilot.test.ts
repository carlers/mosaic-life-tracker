import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryDocument } from '../../src/db/schema';
import {
  toCandidateDiaryWrite, type CandidateDiaryRow, type CandidateIdentity,
} from '../../supabase-poc/candidateMapping';
import {
  CandidatePendingConflictError, createCandidateRxdbPilot,
} from '../../supabase-poc/candidateRxdbPilot';
import { CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';

const { replicate } = vi.hoisted(() => ({ replicate: vi.fn() }));
vi.mock('rxdb/plugins/replication', () => ({ replicateRxCollection: replicate }));

const owner: CandidateIdentity = {
  legacyUserId: 'legacy_private_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const original: DiaryDocument & { _deleted: false } = {
  id: 'd_example', userId: owner.legacyUserId, date: '2026-10-21',
  content: 'My private entry', emoji: '🙂', photos: '[]', visibility: 'private',
  createdAt: '2026-10-21T08:00:00Z', updatedAt: '2026-10-21T08:00:00Z',
  isDeleted: false, _deleted: false,
};
const edited = { ...original, content: 'Saved offline', emoji: '🌙',
  updatedAt: '2026-10-21T09:00:00Z' };
const row = (doc: DiaryDocument = original, revision = '1'): CandidateDiaryRow => ({
  ...toCandidateDiaryWrite(doc, owner),
  change_seq: revision, server_updated_at: '2026-10-21T12:00:00Z',
});

function setup() {
  let signed: { userId: string; accessToken: string; sessionEpoch: number } | null = {
    userId: owner.supabaseUserId, accessToken: 'signed-owner-token', sessionEpoch: 1,
  };
  const session = { getVerifiedSession: vi.fn(async () => signed) };
  const listChanges = vi.fn().mockResolvedValue([]);
  const readDiaryMaster = vi.fn<(id: string) => Promise<CandidateDiaryRow | null>>()
    .mockResolvedValue(null);
  const createDiary = vi.fn().mockResolvedValue({
    state: 'created', row: row(), revision: '1',
  });
  const compareAndSet = vi.fn().mockResolvedValue({
    state: 'applied', row: row(edited, '2'), revision: '2',
  });
  const pilot = createCandidateRxdbPilot<DiaryDocument>({
    domain: 'diary', identity: owner, session,
    changes: { listChanges },
    writer: { readDiaryMaster, createDiary } as never,
    cas: { compareAndSet } as never,
  });
  const push = (doc: typeof original = original, base?: typeof original) =>
    pilot.push([{ newDocumentState: doc, assumedMasterState: base }] as never);
  return {
    pilot, push, readDiaryMaster, createDiary, compareAndSet, listChanges,
    switchAccount(userId: string | null) {
      signed = userId ? { userId, accessToken: 'new-token', sessionEpoch: 2 } : null;
    },
  };
}
beforeEach(() => vi.clearAllMocks());

describe('owner-private Diary native RxDB candidate replication (#1029)', () => {
  it('pulls signed owner rows and tombstones without treating them as physical deletions', async () => {
    const h = setup();
    h.listChanges.mockResolvedValueOnce([{ ...row(original, '9007199254740993'), is_deleted: true }]);
    await expect(h.pilot.pull(undefined, 20)).resolves.toEqual({
      documents: [{ ...original, isDeleted: true }],
      checkpoint: { changeSeq: '9007199254740993' },
    });
    expect(h.listChanges).toHaveBeenCalledWith({
      domain: 'diary', ownerId: owner.supabaseUserId, afterExclusive: '0', batchSize: 20,
    });
  });

  it('creates a new private entry, then accepts an identical replay without duplicating it', async () => {
    const h = setup();
    await expect(h.push()).resolves.toEqual([]);
    expect(h.createDiary).toHaveBeenCalledOnce();
    h.readDiaryMaster.mockResolvedValue(row());
    await expect(h.push()).resolves.toEqual([]);
    expect(h.createDiary).toHaveBeenCalledOnce();
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });

  it('uses an exact server revision and narrowly scoped patch for an offline edit', async () => {
    const h = setup();
    h.readDiaryMaster.mockResolvedValue(row(original, '9007199254740993'));
    h.compareAndSet.mockResolvedValue({
      state: 'applied', row: row(edited, '9007199254740994'),
      revision: '9007199254740994',
    });
    await expect(h.push(edited, original)).resolves.toEqual([]);
    expect(h.compareAndSet).toHaveBeenCalledWith({
      domain: 'diary', ownerId: owner.supabaseUserId, documentId: original.id,
      expectedRevision: '9007199254740993',
      patch: {
        content: 'Saved offline', emoji: '🌙', photos: '[]',
        updated_at: '2026-10-21T09:00:00Z', is_deleted: false,
      },
    });
  });

  it('tombstones an entry via CAS, retaining original calendar date and ID', async () => {
    const h = setup();
    const removed = { ...original, isDeleted: true, updatedAt: '2026-10-21T10:00:00Z' };
    h.readDiaryMaster.mockResolvedValue(row());
    h.compareAndSet.mockResolvedValue({ state: 'applied', row: row(removed, '2'), revision: '2' });
    await expect(h.push(removed, original)).resolves.toEqual([]);
    expect(h.compareAndSet.mock.calls[0][0].patch).toMatchObject({ is_deleted: true });
    expect(h.compareAndSet.mock.calls[0][0].patch).not.toHaveProperty('entry_date');
    expect(h.compareAndSet.mock.calls[0][0].patch).not.toHaveProperty('owner_id');
  });

  it('blocks date, visibility, and creation timestamp edits', async () => {
    const changes: DiaryDocument[] = [
      { ...original, date: '2026-10-22' },
      { ...original, visibility: 'followers' },
      { ...original, createdAt: '2026-10-21T09:00:00Z' },
    ];
    for (const invalid of changes) {
      const h = setup();
      h.readDiaryMaster.mockResolvedValue(row());
      await expect(h.push(invalid as typeof original, original))
        .rejects.toBeInstanceOf(CandidatePendingConflictError);
      expect(h.compareAndSet).not.toHaveBeenCalled();
    }
  });

  it('allows owner-private photo additions/removals under the exact Diary revision CAS', async () => {
    const photoEdited = {
      ...original, photos: '["img_private"]', updatedAt: '2026-10-21T09:00:00Z',
    };
    const h = setup();
    h.readDiaryMaster.mockResolvedValue(row());
    h.compareAndSet.mockResolvedValue({ state: 'applied', row: row(photoEdited, '2'), revision: '2' });
    await expect(h.push(photoEdited, original)).resolves.toEqual([]);
    expect(h.compareAndSet).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'diary', documentId: original.id, ownerId: owner.supabaseUserId,
      expectedRevision: '1',
      patch: expect.objectContaining({ photos: '["img_private"]' }),
    }));
    expect(h.compareAndSet.mock.calls[0][0].patch).not.toHaveProperty('visibility');
    expect(h.compareAndSet.mock.calls[0][0].patch).not.toHaveProperty('owner_id');
  });

  it('never acknowledges divergent device edits or an unexpected foreign row', async () => {
    const h = setup();
    h.readDiaryMaster.mockResolvedValue(row({ ...original, content: 'Other device edited' }, '2'));
    await expect(h.push(edited, original)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    const h2 = setup();
    h2.listChanges.mockResolvedValue([{ ...row(), owner_id: '22222222-2222-4222-8222-222222222222' }]);
    await expect(h2.pilot.pull(undefined, 20)).rejects.toThrow(/foreign|owner/i);
  });

  it('stops accepting pulled results after owner changes during network activity', async () => {
    const h = setup();
    h.listChanges.mockImplementationOnce(async () => {
      h.switchAccount('22222222-2222-4222-8222-222222222222');
      return [row()];
    });
    await expect(h.pilot.pull(undefined, 20)).rejects.toBeInstanceOf(CandidateAuthError);
    expect(h.compareAndSet).not.toHaveBeenCalled();
  });
});
