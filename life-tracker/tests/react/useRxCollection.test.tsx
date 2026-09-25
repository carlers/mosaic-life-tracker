import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsDocument } from '../../src/db/schema';

const subscribeMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_1' } }),
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    settings: {
      find: () => ({
        $: { subscribe: subscribeMock },
      }),
    },
  }),
}));

import { useRxCollection } from '../../src/hooks/useRxCollection';

const doc: SettingsDocument = {
  id: 'setting_1',
  userId: 'user_1',
  key: 'prefs',
  value: '{"view":"calendar"}',
  isDeleted: false,
  updatedAt: '2026-09-23T00:00:00.000Z',
};

describe('useRxCollection performance contract', () => {
  it('preserves mapped data identity across parent rerenders without a new RxDB emission', async () => {
    subscribeMock.mockImplementation((callback: (docs: SettingsDocument[]) => void) => {
      callback([doc]);
      return { unsubscribe: vi.fn() };
    });
    const map = vi.fn((docs: SettingsDocument[]) => ({
      count: docs.length,
      firstKey: docs[0]?.key ?? '',
    }));

    const { result, rerender } = renderHook(() =>
      useRxCollection<SettingsDocument, { count: number; firstKey: string }>({
        collection: 'settings',
        selector: { userId: 'user_1', isDeleted: false },
        map,
        logPrefix: '[test]',
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first = result.current.data;
    rerender();

    expect(result.current.data).toBe(first);
  });
});
