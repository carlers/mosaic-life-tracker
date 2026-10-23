import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  stored: [] as Record<string, unknown>[],
  upsert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/backendCapabilities', () => ({ MOSAIC_FEATURE_PROFILE: 'core-diary' }));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { $id: 'signed_personal_owner' } }) }));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: fixtures.stored.filter(row => !row.isDeleted), isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({ diary: { find: () => ({ exec: async () => fixtures.stored }) } }),
}));
vi.mock('../../src/lib/localUpsert', () => ({ upsertLocalDoc: fixtures.upsert }));
import { useDiary } from '../../src/hooks/useDiary';

beforeEach(() => {
  fixtures.stored = [];
  fixtures.upsert.mockClear().mockResolvedValue(undefined);
});

describe('signed Supabase personal Diary photo saving', () => {
  it('persists up to five owner-private uploaded photo references when creating an entry', async () => {
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.saveEntry(
      '2026-10-23', 'New personal memory', 'private', '🌱', '["img_first","img_second"]'
    ));
    expect(fixtures.upsert).toHaveBeenCalledOnce();
    expect(fixtures.upsert).toHaveBeenCalledWith('diary', expect.any(String), expect.objectContaining({
      userId: 'signed_personal_owner',
      photos: '["img_first","img_second"]',
      visibility: 'private',
      content: 'New personal memory',
      isDeleted: false,
    }));
  });

  it('adds and removes an existing owner Diary photo through normal local-first patches', async () => {
    fixtures.stored = [{
      id: 'old_entry', userId: 'signed_personal_owner', date: '2026-10-23',
      content: 'Existing', photos: '[]', visibility: 'private', isDeleted: false,
    }];
    const { result } = renderHook(() => useDiary());
    await act(async () => result.current.saveEntry(
      '2026-10-23', 'Existing', 'private', '', '["img_added"]'
    ));
    expect(fixtures.upsert).toHaveBeenCalledWith('diary', 'old_entry', expect.objectContaining({
      photos: '["img_added"]',
      visibility: 'private',
    }));
    await act(async () => result.current.saveEntry('2026-10-23', 'Existing', 'private', '', '[]'));
    expect(fixtures.upsert).toHaveBeenLastCalledWith('diary', 'old_entry', expect.objectContaining({
      photos: '[]',
      visibility: 'private',
    }));
  });

  it('still rejects public or follower visibility and invalid photo arrays before local writes', async () => {
    const { result } = renderHook(() => useDiary());
    await expect(result.current.saveEntry('2026-10-23', 'Private', 'public', '', '[]'))
      .rejects.toThrow(/must remain private/);
    await expect(result.current.saveEntry('2026-10-23', 'Private', 'followers', '', '[]'))
      .rejects.toThrow(/must remain private/);
    await expect(result.current.saveEntry('2026-10-23', 'Private', 'private', '', '["data:image/jpeg;base64,abc"]'))
      .rejects.toThrow(/Invalid diary photo list/);
    await expect(result.current.saveEntry('2026-10-23', 'Private', 'private', '', '["img_same","img_same"]'))
      .rejects.toThrow(/Invalid diary photo list/);
    expect(fixtures.upsert).not.toHaveBeenCalled();
  });
});
