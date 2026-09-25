import { describe, expect, it, vi } from 'vitest';
import { initializeDatabaseWithRetry } from '../../src/db/database';

describe('database bootstrap retry', () => {
  // Regression: DB-BOOT-1 — transient mobile IndexedDB failures must not
  // leave Mosaic permanently mounted without an RxDB instance.
  it('retries transient initialization failures and returns the recovered database', async () => {
    const recovered = { name: 'db' } as never;
    const initialize = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary indexeddb failure'))
      .mockRejectedValueOnce(new Error('temporary indexeddb failure'))
      .mockResolvedValueOnce(recovered);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      initializeDatabaseWithRetry({
        attempts: 3,
        delayMs: 10,
        initialize,
        sleep,
      })
    ).resolves.toBe(recovered);

    expect(initialize).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });

  it('surfaces the final initialization error after the retry budget is exhausted', async () => {
    const initialize = vi.fn().mockRejectedValue(new Error('indexeddb blocked'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      initializeDatabaseWithRetry({
        attempts: 2,
        delayMs: 5,
        initialize,
        sleep,
      })
    ).rejects.toThrow('indexeddb blocked');

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
