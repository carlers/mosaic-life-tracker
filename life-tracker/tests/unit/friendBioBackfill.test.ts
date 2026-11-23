import { describe, expect, it, vi } from 'vitest';
import { backfillMissingFriendBios, backfillUntriedFriendBios } from '../../src/lib/friendBioBackfill';

const rows = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: 'friendship_' + index,
  friendId: 'user_' + index,
}));

describe('lazy friend bio enrichment', () => {
  it('marks only missing bios for one session, never retrying already-attempted friends', async () => {
    const attempted = new Set(['user_0']);
    const readBio = vi.fn(async (id: string) => 'bio ' + id);
    const writeBio = vi.fn(async () => {});
    const friends = [
      { id: 'f0', friendId: 'user_0', friendBio: '' },
      { id: 'f1', friendId: 'user_1', friendBio: 'existing' },
      { id: 'f2', friendId: 'user_2', friendBio: '' },
    ];
    await backfillUntriedFriendBios(friends, attempted, () => false, {readBio,writeBio});
    expect([...attempted].sort()).toEqual(['user_0', 'user_2']);
    expect(readBio).toHaveBeenCalledWith('user_2');
    expect(readBio).toHaveBeenCalledTimes(1);
    await backfillUntriedFriendBios(friends, attempted, () => false, {readBio,writeBio});
    expect(readBio).toHaveBeenCalledTimes(1);
    expect(writeBio).toHaveBeenCalledOnce();
  });

  it('does not consume untried bio IDs after cancellation before lazy worker runs', async () => {
    const attempted = new Set<string>();
    const readBio = vi.fn(async () => 'bio');
    await backfillUntriedFriendBios([{id:'f',friendId:'u',friendBio:''}], attempted, () => true,
      {readBio,writeBio:vi.fn(async () => {})});
    expect(attempted.size).toBe(0);
    expect(readBio).not.toHaveBeenCalled();
  });

  it('limits concurrent bio reads to four and preserves all local writes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let inFlight = 0;
    let peak = 0;
    const writes: string[] = [];
    const work = backfillMissingFriendBios(rows(12), () => false, {
      readBio: async (id) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await gate;
        inFlight--;
        return 'bio-' + id;
      },
      writeBio: async (id, bio) => { writes.push(id + '=' + bio); },
    });
    expect(peak).toBe(4);
    release();
    await work;
    expect(writes).toHaveLength(12);
    expect(new Set(writes).size).toBe(12);
    expect(peak).toBe(4);
  });

  it('does not write or dispatch more work after cancellation during an in-flight read', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let cancelled = false;
    const readBio = vi.fn(async () => { await gate; return 'private bio'; });
    const writeBio = vi.fn(async () => {});
    const work = backfillMissingFriendBios(rows(8), () => cancelled, { readBio, writeBio });
    expect(readBio).toHaveBeenCalledTimes(4);
    cancelled = true;
    release();
    await work;
    expect(writeBio).not.toHaveBeenCalled();
    expect(readBio).toHaveBeenCalledTimes(4);
  });

  it('treats failed or empty lookups as per-friend no-ops without cancelling other work', async () => {
    const onError = vi.fn();
    const writeBio = vi.fn(async () => {});
    await backfillMissingFriendBios(rows(3), () => false, {
      readBio: async (id) => {
        if (id === 'user_0') throw new Error('temporary network failure');
        return id === 'user_1' ? undefined : 'available';
      },
      writeBio,
      onError,
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(writeBio).toHaveBeenCalledOnce();
    expect(writeBio).toHaveBeenCalledWith('friendship_2', 'available');
  });
});
