import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { awaitPilotReplicationFreshness } from '../../src/db/replicationFreshness';

afterEach(() => {
  vi.useRealTimers();
});

describe('fresh RxDB replication leader election', () => {
  it('accepts a delayed phone/PWA election instead of incorrectly blaming another tab after one second', async () => {
    vi.useFakeTimers();
    let leader = false;
    const waitForLeadership = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            leader = true;
            resolve(true);
          }, 2_000);
        })
    );
    const reSync = vi.fn();
    const awaitInSync = vi.fn().mockResolvedValue(true);
    const pending = awaitPilotReplicationFreshness(
      'category',
      { reSync, awaitInSync },
      { database: { isLeader: () => leader, waitForLeadership } },
      15_000
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(reSync).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toBeUndefined();
    expect(waitForLeadership).toHaveBeenCalledOnce();
    expect(reSync).toHaveBeenCalledOnce();
    expect(awaitInSync).toHaveBeenCalledOnce();
  });

  it('honors the caller deadline and does not start replication without local leadership', async () => {
    vi.useFakeTimers();
    const reSync = vi.fn();
    const awaitInSync = vi.fn().mockResolvedValue(true);
    const pending = awaitPilotReplicationFreshness(
      'diary',
      { reSync, awaitInSync },
      {
        database: {
          isLeader: () => false,
          waitForLeadership: () => new Promise<boolean>(() => undefined),
        },
      },
      2_000
    );
    const rejected = expect(pending).rejects.toThrow(
      'Fresh diary sync timed out waiting for local database leadership'
    );
    await vi.advanceTimersByTimeAsync(2_000);
    await rejected;
    expect(reSync).not.toHaveBeenCalled();
    expect(awaitInSync).not.toHaveBeenCalled();
  });

  it('caps the leader wait at ten seconds even with a long caller deadline', async () => {
    vi.useFakeTimers();
    const reSync = vi.fn();
    const pending = awaitPilotReplicationFreshness(
      'category',
      { reSync, awaitInSync: vi.fn().mockResolvedValue(true) },
      {
        database: {
          isLeader: () => false,
          waitForLeadership: () => new Promise<boolean>(() => undefined),
        },
      },
      90_000
    );
    const rejected = expect(pending).rejects.toThrow(
      'Fresh category sync timed out waiting for local database leadership'
    );
    await vi.advanceTimersByTimeAsync(9_999);
    expect(reSync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(reSync).not.toHaveBeenCalled();
  });

  it('ends manual freshness promptly on a permanent Preferences rejection without deleting retries', async () => {
    const error$ = new Subject<Error>();
    const reSync = vi.fn(() => {
      error$.next(Object.assign(new Error('private setting value'), {
        code: 403, syncStage: 'profile',
      }));
    });
    const pending = awaitPilotReplicationFreshness(
      'settings',
      { reSync, awaitInSync: () => new Promise<true>(() => undefined), error$ },
      { database: { isLeader: () => true, waitForLeadership: vi.fn() } },
      90_000
    );
    await expect(pending).rejects.toThrow(/Profile mirror: HTTP 403/);
    expect(reSync).toHaveBeenCalledOnce();
    expect(error$.observers).toHaveLength(0);
  });

  it('keeps retrying transient Preferences server errors until in sync', async () => {
    const error$ = new Subject<Error>();
    const reSync = vi.fn(() => error$.next(Object.assign(new Error('transient'), { code: 503 })));
    const pending = awaitPilotReplicationFreshness(
      'settings',
      { reSync, awaitInSync: () => Promise.resolve(true), error$ },
      { database: { isLeader: () => true, waitForLeadership: vi.fn() } },
      5_000
    );
    await expect(pending).resolves.toBeUndefined();
    expect(error$.observers).toHaveLength(0);
  });

  it('does not wait or elect when this device already owns replication', async () => {
    const waitForLeadership = vi.fn();
    const reSync = vi.fn();
    await expect(
      awaitPilotReplicationFreshness(
        'category',
        { reSync, awaitInSync: vi.fn().mockResolvedValue(true) },
        { database: { isLeader: () => true, waitForLeadership } },
        5_000
      )
    ).resolves.toBeUndefined();
    expect(waitForLeadership).not.toHaveBeenCalled();
    expect(reSync).toHaveBeenCalledOnce();
  });
});
