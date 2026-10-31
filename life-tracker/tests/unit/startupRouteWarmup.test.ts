import { describe, expect, it, vi } from 'vitest';

describe('Home start and neighbor-preload readiness', () => {
  it('notifies a subscriber once after the first Home data-ready mark', async () => {
    vi.resetModules();
    const { markStartup, subscribeStartupMark } = await import('../../src/lib/startupMetrics');
    const listener = vi.fn();
    const unsubscribe = subscribeStartupMark('home:local-data-ready', listener);
    expect(listener).not.toHaveBeenCalled();
    markStartup('home:local-data-ready');
    markStartup('home:local-data-ready');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    const late = vi.fn();
    subscribeStartupMark('home:local-data-ready', late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('does not notify disposed startup subscribers', async () => {
    vi.resetModules();
    const { markStartup, subscribeStartupMark } = await import('../../src/lib/startupMetrics');
    const callback = vi.fn();
    subscribeStartupMark('home:local-data-ready', callback)();
    markStartup('home:local-data-ready');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not let a failed diagnostic listener block Home readiness', async () => {
    vi.resetModules();
    const { markStartup, subscribeStartupMark } = await import('../../src/lib/startupMetrics');
    const next = vi.fn();
    subscribeStartupMark('home:local-data-ready', () => { throw Error('diagnostics'); });
    subscribeStartupMark('home:local-data-ready', next);
    expect(() => markStartup('home:local-data-ready')).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
