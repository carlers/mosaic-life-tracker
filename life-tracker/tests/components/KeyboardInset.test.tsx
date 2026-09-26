import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardInset } from '../../src/components/messages/useKeyboardInset';

describe('useKeyboardInset', () => {
  let listeners: Record<string, () => void>;
  let viewport: {
    height: number;
    offsetTop: number;
    scale: number;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };

  beforeEach(() => {
    listeners = {};
    viewport = {
      height: 844,
      offsetTop: 0,
      scale: 1,
      addEventListener: (type, listener) => {
        listeners[type] = listener;
      },
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns zero with a closed keyboard', () => {
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('tracks the visible viewport above an open keyboard', () => {
    const { result } = renderHook(() => useKeyboardInset());

    viewport.height = 500;
    act(() => {
      listeners.resize?.();
    });

    expect(result.current).toBe(344);
  });

  it('accounts for Safari visual viewport offset', () => {
    const { result } = renderHook(() => useKeyboardInset());

    viewport.height = 520;
    viewport.offsetTop = 24;
    act(() => {
      listeners.scroll?.();
    });

    expect(result.current).toBe(300);
  });
});
