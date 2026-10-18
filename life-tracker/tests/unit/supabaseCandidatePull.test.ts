import { describe, expect, it, vi } from 'vitest';
import {
  pullCandidateCategories,
  pullCandidateTasks,
  type CandidateChangeTransport,
} from '../../supabase-poc/candidatePull';
import type { CandidateIdentity, CandidateCategoryRow, CandidateTaskRow } from '../../supabase-poc/candidateMapping';

const identity: CandidateIdentity = {
  legacyUserId: 'existing_appwrite_user',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const category: CandidateCategoryRow = {
  owner_id: identity.supabaseUserId,
  id: 'legacy-category',
  name: 'Personal',
  color: '#aabbcc',
  order_index: 3,
  visibility: 'private',
  icon: null,
  updated_at: 'now',
  is_deleted: false,
  change_seq: '9007199254740993',
  server_updated_at: 'now',
};
const task: CandidateTaskRow = {
  owner_id: identity.supabaseUserId,
  id: 'legacy-task',
  title: 'Reminder',
  completed: true,
  category_id: category.id,
  order_index: 1,
  tags: null,
  task_date: '2026-10-19',
  memo: null,
  image: null,
  created_at: '2026-10-18',
  completed_at: null,
  updated_at: '2026-10-19',
  source: null,
  routine_id: null,
  reminder_time: null,
  reactions: null,
  visibility: 'private',
  is_deleted: true,
  change_seq: '20',
  server_updated_at: 'now',
};

function makeTransport(rows: unknown[]) {
  const fn = vi.fn().mockResolvedValue(rows);
  return { client: { listChanges: fn } as unknown as CandidateChangeTransport, fn };
}

describe('isolated Supabase change pull boundary', () => {
  it('preserves bigint page cursors and local logical tombstones', async () => {
    const second = { ...category, id: 'legacy-2', is_deleted: true, change_seq: '9007199254740994' };
    const { client, fn } = makeTransport([category, second]);
    const result = await pullCandidateCategories({
      transport: client,
      identity,
      checkpoint: { changeSeq: '9007199254740992' },
      batchSize: 2,
    });
    expect(fn).toHaveBeenCalledWith({
      domain: 'categories',
      ownerId: identity.supabaseUserId,
      afterExclusive: '9007199254740992',
      batchSize: 2,
    });
    expect(result.checkpoint).toEqual({ changeSeq: '9007199254740994' });
    expect(result.documents).toHaveLength(2);
    expect(result.documents[1]).toMatchObject({
      id: 'legacy-2', userId: identity.legacyUserId, isDeleted: true, _deleted: false,
    });
  });

  it('keeps tombstones in task pull rather than physically deleting RxDB documents', async () => {
    const { client } = makeTransport([task]);
    const result = await pullCandidateTasks({
      transport: client, identity, checkpoint: { changeSeq: '19' }, batchSize: 100,
    });
    expect(result.documents).toEqual([
      expect.objectContaining({
        id: 'legacy-task', categoryId: 'legacy-category', isDeleted: true, _deleted: false,
      }),
    ]);
    expect(result.checkpoint).toEqual({ changeSeq: '20' });
  });

  it('preserves the checkpoint when the page is empty', async () => {
    const { client } = makeTransport([]);
    const checkpoint = { changeSeq: '80000000000000000' };
    const result = await pullCandidateCategories({
      transport: client, identity, checkpoint, batchSize: 25,
    });
    expect(result).toEqual({ documents: [], checkpoint });
  });

  it('finds a missed event on the next checkpointed pull without Realtime', async () => {
    const fn = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([category]);
    const transport = { listChanges: fn } as unknown as CandidateChangeTransport;
    const checkpoint = { changeSeq: '9007199254740992' };
    const first = await pullCandidateCategories({ transport, identity, checkpoint, batchSize: 10 });
    expect(first).toEqual({ documents: [], checkpoint });
    const second = await pullCandidateCategories({
      transport, identity, checkpoint: first.checkpoint, batchSize: 10,
    });
    expect(second.checkpoint).toEqual({ changeSeq: '9007199254740993' });
    expect(second.documents).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects wrong-owner, unordered, duplicate and oversized batches', async () => {
    const invalidPages = [
      [{ ...category, owner_id: '22222222-2222-4222-8222-222222222222' }],
      [category, { ...category, id: 'duplicate', change_seq: category.change_seq }],
      [{ ...category, change_seq: '10' }],
      [category, { ...category, id: 'next', change_seq: '9007199254740994' }],
    ];
    for (const [idx, page] of invalidPages.entries()) {
      const { client } = makeTransport(page);
      const checkpoint = { changeSeq: '9007199254740992' };
      await expect(pullCandidateCategories({
        transport: client, identity, checkpoint, batchSize: idx === 3 ? 1 : 2,
      })).rejects.toThrow();
    }
  });

  it('rejects unsafe numeric revisions and missing deletion flags', async () => {
    for (const row of [
      { ...category, change_seq: 9007199254740992 },
      { ...category, is_deleted: null },
    ]) {
      const { client } = makeTransport([row]);
      await expect(pullCandidateCategories({ transport: client, identity, batchSize: 3 }))
        .rejects.toThrow();
    }
  });

  it('never returns an advanced checkpoint on transport failure', async () => {
    const client = { listChanges: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as CandidateChangeTransport;
    await expect(pullCandidateCategories({
      transport: client, identity, checkpoint: { changeSeq: '7' }, batchSize: 10,
    })).rejects.toThrow('offline');
  });

  it('rejects invalid account identity before any remote requests', async () => {
    const { client, fn } = makeTransport([]);
    await expect(pullCandidateCategories({
      transport: client,
      identity: { legacyUserId: identity.legacyUserId, supabaseUserId: 'not-a-uuid' },
      batchSize: 10,
    })).rejects.toThrow('Supabase Auth UUID');
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects invalid batch sizes before any remote requests', async () => {
    const { client, fn } = makeTransport([]);
    await expect(pullCandidateTasks({ transport: client, identity, batchSize: 101 }))
      .rejects.toThrow('batch size');
    expect(fn).not.toHaveBeenCalled();
  });
});
