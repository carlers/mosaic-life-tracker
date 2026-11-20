import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  owner: 'user_A',
  patches: vi.fn(),
  writes: vi.fn(),
}));
function wrap(row: Record<string, unknown>) {
  return {
    toJSON: () => ({ ...row }),
    incrementalPatch: async (patch: Record<string, unknown>) => {
      Object.assign(row, patch);
      state.patches(row.id, patch);
    },
  };
}
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    diary: {
      findOne: (id: string) => ({ exec: async () => {
        const row = state.rows.find(item => item.id === id);
        return row ? wrap(row) : null;
      } }),
      find: ({ selector }: { selector: { userId: string; date: string } }) => ({
        exec: async () => state.rows.filter(row =>
          row.userId === selector.userId && row.date === selector.date).map(wrap),
      }),
    },
  }),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: state.owner } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({
    data: state.rows.filter(row => row.userId === state.owner && !row.isDeleted),
    isLoading: false,
  }),
}));
vi.mock('../../src/lib/accountWorkScope', () => ({
  captureAccountWorkGeneration: (owner: string) => owner === state.owner ? 1 : null,
  isAccountWorkCurrent: (owner: string, generation: number) => owner === state.owner && generation === 1,
}));
vi.mock('../../src/lib/localUpsert', () => ({
  upsertLocalDoc: async (_collection: string, id: string, document: Record<string, unknown>) => {
    state.writes(id, document);
    const old = state.rows.find(row => row.id === id);
    if (old) Object.assign(old, document); else state.rows.push({ ...document });
  },
}));
import { useDiary } from '../../src/hooks/useDiary';

const iso = '2026-10-02T08:00:00.000Z';
function row(id: string, date = '2026-10-01', createdAt = iso) {
  return { id, userId: 'user_A', date, createdAt, updatedAt: iso,
    content: 'original', visibility: 'followers', emoji: '', photos: '[]', isDeleted: false };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  state.rows = [];
  state.owner = 'user_A';
  state.patches.mockReset();
  state.writes.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('independent owner-scoped diary entries', () => {
  it('creates two private entries on the same day with distinct portable IDs', async () => {
    const { result, rerender } = renderHook(() => useDiary());
    let first = '', second = '';
    await act(async () => {
      first = await result.current.createEntry('2026-10-01', 'morning', 'private', '🌱');
      second = await result.current.createEntry('2026-10-01', 'evening', 'private', '🌙');
    });
    expect(first).toMatch(/^d_[a-f0-9]{32}$/);
    expect(second).toMatch(/^d_[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
    rerender();
    expect(result.current.getEntriesByDate('2026-10-01').map(item => item.id)).toEqual([first, second].sort());
    expect(state.rows.map(item => item.visibility)).toEqual(['private', 'private']);
  });

  it('updates and deletes only the selected ID without altering siblings', async () => {
    state.rows = [row('older'), row('newer')];
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.updateEntry('newer', '2026-10-01', 'changed', 'private'));
    expect(state.rows.find(item => item.id === 'older')?.content).toBe('original');
    expect(state.rows.find(item => item.id === 'newer')?.content).toBe('changed');
    await act(async () => result.current.deleteEntryById('newer'));
    expect(state.rows.find(item => item.id === 'newer')?.isDeleted).toBe(true);
    expect(state.rows.find(item => item.id === 'older')?.isDeleted).toBe(false);
  });

  it('preserves original visibility and immutable ID for edits to legacy rows', async () => {
    state.rows = [row('legacy_import')];
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.updateEntry('legacy_import', '2026-10-01', 'edited', 'followers'));
    expect(state.writes).toHaveBeenCalledWith('legacy_import',
      expect.objectContaining({ content: 'edited', visibility: 'followers', createdAt: iso }));
  });

  it('does not revive a public tombstone while creating a new diary entry', async () => {
    state.rows = [{ ...row('deleted_entry'), isDeleted: true, visibility: 'public' }];
    const { result } = renderHook(() => useDiary());
    await act(async () => { await result.current.createEntry('2026-10-01', 'new reflection'); });
    expect(state.rows).toHaveLength(2);
    expect(state.rows[0].isDeleted).toBe(true);
    expect(state.rows[1]).toMatchObject({ visibility: 'private', isDeleted: false });
  });

  it('creates a third entry without mutating two existing entries on that day', async () => {
    state.rows = [row('a'), row('b')];
    const { result, rerender } = renderHook(() => useDiary());
    await act(async () => { await result.current.createEntry('2026-10-01', 'additional'); });
    rerender();
    expect(result.current.getEntriesByDate('2026-10-01')).toHaveLength(3);
    expect(state.rows[0].content).toBe('original');
    expect(state.rows[1].content).toBe('original');
    expect(state.writes).toHaveBeenCalledTimes(1);
    expect(state.patches).not.toHaveBeenCalled();
  });

  it('denies writes if the active account changes while the lazy handler loads', async () => {
    const { result } = renderHook(() => useDiary());
    const pending = result.current.createEntry('2026-10-01', 'do not leak');
    state.owner = 'user_B';
    await expect(pending).rejects.toThrow(/Diary account changed/);
    expect(state.writes).not.toHaveBeenCalled();
  });

  it('refuses foreign owner ID updates and invalid dates', async () => {
    state.rows = [{ ...row('foreign'), userId: 'another_user' }];
    const { result } = renderHook(() => useDiary());
    await expect(result.current.updateEntry('foreign', '2026-10-01', 'stolen', 'public')).rejects.toThrow(/unavailable/);
    await expect(result.current.deleteEntryById('foreign')).rejects.toThrow(/unavailable/);
    await expect(result.current.createEntry('2026-02-31', 'bad')).rejects.toThrow('Invalid');
    expect(state.writes).not.toHaveBeenCalled();
  });
});
