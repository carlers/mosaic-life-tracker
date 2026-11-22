import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenHomeIdle } from '../../src/lib/whenHomeIdle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Home preloading idle scheduling', () => {
  it('uses and cancels browser idle callbacks without scheduling a timeout', () => {
    const invoke = vi.fn().mockReturnValue(47);
    const cancel = vi.fn();
    vi.stubGlobal('window', { requestIdleCallback: invoke, cancelIdleCallback: cancel, setTimeout: vi.fn() });
    const work = vi.fn();
    const dispose = whenHomeIdle(work, 1800, 700);
    expect(invoke).toHaveBeenCalledWith(work, { timeout: 1800 });
    expect(window.setTimeout).not.toHaveBeenCalled();
    dispose();
    expect(cancel).toHaveBeenCalledWith(47);
  });
  it('falls back to a cancellable timer when requestIdleCallback is absent', () => {
    const schedule = vi.fn().mockReturnValue(123);
    const cancel = vi.fn();
    vi.stubGlobal('window', { setTimeout: schedule, clearTimeout: cancel });
    const work = vi.fn();
    const dispose = whenHomeIdle(work, 1200, 900);
    expect(schedule).toHaveBeenCalledWith(work, 900);
    dispose();
    expect(cancel).toHaveBeenCalledWith(123);
  });
});
