import { describe, expect, it, vi } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import { makeBackendParityFixtures, PARITY_OWNERS } from '../fixtures/backendProviderParity';
import {
  toCandidateTaskWrite, type CandidateIdentity, type CandidateTaskRow,
} from '../../supabase-poc/candidateMapping';
import {
  CandidatePendingConflictError, createCandidateRxdbPilot,
} from '../../supabase-poc/candidateRxdbPilot';

const identity: CandidateIdentity = {
  legacyUserId: PARITY_OWNERS.a,
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const original = {
  ...makeBackendParityFixtures().a.tasks[0], _deleted: false as const,
};
const edited = { ...original, title: 'Owner changed title', updatedAt: '2026-10-20' };
function master(doc: TaskDocument = original, revision = '1'): CandidateTaskRow {
  return { ...toCandidateTaskWrite(doc, identity),
    change_seq: revision, server_updated_at: '2026-10-20T00:00:00Z' };
}
function setup(local = edited) {
  const readTaskMaster = vi.fn().mockResolvedValue(master());
  const createTask = vi.fn().mockResolvedValue({
    state: 'created', row: master(local), revision: '1',
  });
  const compareAndSet = vi.fn().mockResolvedValue({
    state: 'applied', row: master(local, '2'), revision: '2',
  });
  const findOne = vi.fn().mockReturnValue({
    exec: async () => ({ toJSON: () => ({ ...local }) }),
  });
  const pilot = createCandidateRxdbPilot<TaskDocument>({
    domain: 'tasks', identity,
    session: { getVerifiedSession: async () => ({
      userId: identity.supabaseUserId, accessToken: 'local-test-signed-token', sessionEpoch: 1,
    }) },
    changes: { listChanges: vi.fn().mockResolvedValue([]) },
    writer: { readTaskMaster, createTask, readCategoryMaster: vi.fn(), createCategory: vi.fn() } as never,
    cas: { compareAndSet } as never,
    collection: { findOne } as never,
  });
  const push = (next = local, assumed?: typeof original) => pilot.push([{
    newDocumentState: next, assumedMasterState: assumed,
  }] as never);
  return { pilot, push, readTaskMaster, createTask, compareAndSet, findOne };
}

describe('source-only task CAS protected metadata (#967)', () => {
  it('keeps ordinary owner edits and preserves original metadata outside the CAS payload', async () => {
    const h = setup();
    await expect(h.push(edited, original)).resolves.toEqual([]);
    expect(h.compareAndSet).toHaveBeenCalledOnce();
    const req = h.compareAndSet.mock.calls[0][0];
    expect(req).toMatchObject({
      domain: 'tasks', ownerId: identity.supabaseUserId,
      documentId: original.id, expectedRevision: '1',
      patch: { title: 'Owner changed title' },
    });
    for (const field of ['id', 'owner_id', 'change_seq', 'created_at', 'reactions']) {
      expect(req.patch).not.toHaveProperty(field);
    }
  });

  it.each([
    ['creation timestamp', { createdAt: '2001-01-01' }],
    ['reaction actor state', { reactions: 'forged-actor-reaction' }],
  ])('holds attempted %s mutation for review without sending owner CAS', async (_, fields) => {
    const draft = { ...edited, ...fields };
    const h = setup(draft);
    await expect(h.push(draft, original))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()[0]).toMatchObject({
      domain: 'tasks', documentId: original.id,
      reason: 'protected-field-change', local: fields,
      remote: { createdAt: original.createdAt, reactions: original.reactions },
      remoteRevision: '1',
    });
    await expect(h.pilot.resolveKeepLocal(original.id, '1'))
      .rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.compareAndSet).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()[0].reason).toBe('protected-field-change');
  });

  it('refuses nonempty reactions on initial task creation, without a write', async () => {
    const forged = { ...original, reactions: 'fabricated-friend-reaction' };
    const h = setup(forged);
    h.readTaskMaster.mockResolvedValue(null);
    await expect(h.push(forged)).rejects.toBeInstanceOf(CandidatePendingConflictError);
    expect(h.createTask).not.toHaveBeenCalled();
    expect(h.pilot.listPendingConflicts()[0].reason).toBe('protected-field-change');
  });

  it('still creates owner-private tasks with empty reaction state', async () => {
    const h = setup(original);
    h.readTaskMaster.mockResolvedValue(null);
    await expect(h.push(original)).resolves.toEqual([]);
    expect(h.createTask).toHaveBeenCalledOnce();
    expect(h.pilot.listPendingConflicts()).toEqual([]);
  });
});
