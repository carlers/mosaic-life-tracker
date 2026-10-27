import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storedDocs = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));
const upsertMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    diary: { find: () => ({ exec: async () => storedDocs.current.map(doc=>({
      ...doc,incrementalPatch:doc.incrementalPatch??((patch:object)=>upsertMock('diary',doc.id,patch)),
    })) }),insert:(doc:{id:string})=>upsertMock('diary',doc.id,doc) },
  }),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_A' } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: storedDocs.current.filter(doc => !doc.isDeleted), isLoading: false }),
}));
vi.mock('../../src/lib/localUpsert', () => ({ upsertLocalDoc: upsertMock }));
import { useDiary } from '../../src/hooks/useDiary';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T08:00:00.000Z'));
  storedDocs.current = [];
  upsertMock.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('diary local-first save/edit/delete', () => {
  it('creates an owner-private entry with normalized date key and optional emoji', async () => {
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.saveEntry('2026-10-01', 'hello', undefined, '🌱'));
    expect(upsertMock).toHaveBeenCalledWith('diary', expect.any(String),
      expect.objectContaining({ date: '2026-10-01', content: 'hello', emoji: '🌱', visibility: 'private' }));
  });
  it('preserves existing visibility and original row id on edits', async () => {
    storedDocs.current = [{ id: 'legacy_import', date: '2026-10-01', userId: 'user_A',
      content: 'old', emoji: '', visibility: 'followers', isDeleted: false }];
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.saveEntry('2026-10-01', 'new'));
    expect(upsertMock).toHaveBeenCalledWith('diary', 'legacy_import',
      expect.objectContaining({ content: 'new', visibility: 'followers', isDeleted: false }));
  });
  it('resurrected diary defaults to private instead of retaining a deleted public audience', async () => {
    storedDocs.current = [{ id: 'old_deleted', userId: 'user_A', date: '2026-10-01',
      content: 'old', visibility: 'public', isDeleted: true }];
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.saveEntry('2026-10-01', 'new day'));
    expect(upsertMock).toHaveBeenCalledWith('diary', 'old_deleted',
      expect.objectContaining({ visibility: 'private', isDeleted: false }));
  });
  it('tombstones the actual stored row with a monotonic edit time', async () => {
    const incrementalPatch = vi.fn().mockResolvedValue(undefined);
    storedDocs.current = [{ id: 'imported', userId: 'user_A', date: '2026-10-01',
      isDeleted: false, incrementalPatch }];
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.deleteEntry('2026-10-01'));
    expect(incrementalPatch).toHaveBeenCalledWith({
      isDeleted: true, updatedAt: '2026-10-02T08:00:00.000Z',
    });
  });
  it('refuses duplicate legacy entries and invalid dates without writes', async () => {
    storedDocs.current = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useDiary());
    await expect(result.current.saveEntry('2026-02-31', 'bad')).rejects.toThrow('Invalid');
    await expect(result.current.saveEntry('2026-10-01', 'good')).rejects.toThrow('Multiple');
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
