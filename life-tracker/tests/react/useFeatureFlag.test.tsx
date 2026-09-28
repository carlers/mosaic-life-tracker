// Regression: §24.15 (feature flags fail closed and expose load/error state).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const adapterRef = vi.hoisted(() => ({
  state: { enabled: false, isLoaded: false, hasError: false },
  listener: null as (() => void) | null,
}));

vi.mock('../../src/lib/posthog', () => ({
  getPostHogFeatureFlagState: () => adapterRef.state,
  subscribePostHogFeatureFlags: (listener: () => void) => {
    adapterRef.listener = listener;
    return () => {
      if (adapterRef.listener === listener) adapterRef.listener = null;
    };
  },
}));

import { useFeatureFlag } from '../../src/hooks/useFeatureFlag';

describe('useFeatureFlag', () => {
  beforeEach(() => {
    adapterRef.state = { enabled: false, isLoaded: false, hasError: false };
    adapterRef.listener = null;
  });

  it('starts fail-closed before flags are loaded', () => {
    const { result } = renderHook(() => useFeatureFlag('new-ui'));
    expect(result.current).toEqual({
      enabled: false,
      isLoaded: false,
      hasError: false,
    });
  });

  it('exposes a loaded enabled flag', () => {
    adapterRef.state = { enabled: true, isLoaded: true, hasError: false };
    const { result } = renderHook(() => useFeatureFlag('new-ui'));
    expect(result.current).toEqual({
      enabled: true,
      isLoaded: true,
      hasError: false,
    });
  });

  it('updates after a feature-flag reload notification', () => {
    const { result } = renderHook(() => useFeatureFlag('new-ui'));

    act(() => {
      adapterRef.state = { enabled: true, isLoaded: true, hasError: false };
      adapterRef.listener?.();
    });

    expect(result.current).toEqual({
      enabled: true,
      isLoaded: true,
      hasError: false,
    });
  });

  it('reports load failure while keeping the flag disabled', () => {
    const { result } = renderHook(() => useFeatureFlag('new-ui'));

    act(() => {
      adapterRef.state = { enabled: false, isLoaded: false, hasError: true };
      adapterRef.listener?.();
    });

    expect(result.current).toEqual({
      enabled: false,
      isLoaded: false,
      hasError: true,
    });
  });

});
