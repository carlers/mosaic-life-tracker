import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ disabled: false, listener: null as (() => void) | null }));

vi.mock('../../src/hooks/useFeatureFlag', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useFeatureFlag: () => ({
      enabled: useSyncExternalStore(
        (listener: () => void) => { store.listener = listener; return () => { store.listener = null; }; },
        () => store.disabled,
      ),
      isLoaded: true,
      hasError: false,
    }),
  };
});

import { useFeatureEnabled } from '../../src/hooks/useFeatureEnabled';

describe('useFeatureEnabled', () => {
  beforeEach(() => { store.disabled = false; store.listener = null; });

  it('updates optional feature rendering after a remote kill switch changes', () => {
    const { result } = renderHook(() => useFeatureEnabled('settingsSearch'));
    expect(result.current).toBe(true);
    act(() => { store.disabled = true; store.listener?.(); });
    expect(result.current).toBe(false);
    act(() => { store.disabled = false; store.listener?.(); });
    expect(result.current).toBe(true);
  });
});
