import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startSyncWatchdog,
  SYNC_WATCHDOG_INTERVAL_MS,
} from '../../src/db/syncWatchdog';

describe('sync watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only requests a catch-up while its visibility/connectivity gate is open', () => {
    let enabled = false;
    const onTick = vi.fn();
    const stop = startSyncWatchdog({
      shouldRun: () => enabled,
      onTick,
    });

    vi.advanceTimersByTime(SYNC_WATCHDOG_INTERVAL_MS);
    expect(onTick).not.toHaveBeenCalled();

    enabled = true;
    vi.advanceTimersByTime(SYNC_WATCHDOG_INTERVAL_MS);
    expect(onTick).toHaveBeenCalledTimes(1);

    stop();
    vi.advanceTimersByTime(SYNC_WATCHDOG_INTERVAL_MS);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
