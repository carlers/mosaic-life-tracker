import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useChatViewport } from '../../src/components/messages/useChatViewport';

describe('useChatViewport', () => {
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

  it('uses visible height with a closed keyboard', () => {
    const { result } = renderHook(() => useChatViewport(true));
    expect(result.current).toEqual({ height: 844, top: 0 });
  });

  it('tracks the visible viewport above an open keyboard', () => {
    const { result } = renderHook(() => useChatViewport(true));

    viewport.height = 500;
    act(() => {
      listeners.resize?.();
    });

    expect(result.current).toEqual({ height: 500, top: 0 });
  });

  it('ignores pinch zoom', () => {
    viewport.scale = 2;
    const { result } = renderHook(() => useChatViewport(true));
    expect(result.current).toBeUndefined();
  });

  it('leaves other routes unchanged', () => {
    const { result } = renderHook(() => useChatViewport(false));
    expect(result.current).toBeUndefined();
  });

  it('accounts for Safari visual viewport offset', () => {
    const { result } = renderHook(() => useChatViewport(true));

    viewport.height = 520;
    viewport.offsetTop = 24;
    act(() => {
      listeners.scroll?.();
    });

    expect(result.current).toEqual({ height: 520, top: 24 });
  });
});
