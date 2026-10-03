import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { silenceExpectedConsole } from '../helpers/expectedConsole';

const localStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  const mock = {
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k) ?? null : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as unknown as { localStorage: typeof mock }).localStorage = mock;
  return mock;
});

import {
  enqueueSocialOp,
  flushSocialOutbox,
  clearSocialOutbox,
  getSocialOutboxSize,
  setSocialOutboxSender,
  subscribeToSocialOutboxFailures,
  emitSocialOutboxFailure,
  __resetSocialOutboxForTests,
  type SocialOutboxFailureEvent,
  type SocialOutboxRemoteOp,
} from '../../src/lib/socialOutbox';
import {
  __resetAccountWorkScopeForTests,
  scopeAccountWork,
} from '../../src/lib/accountWorkScope';

const STORAGE_KEY = 'mosaic_social_outbox';

function storedEntries(): SocialOutboxQueuedEntry[] {
  const prefix = STORAGE_KEY + ':entry:';
  const entries: SocialOutboxQueuedEntry[] = [];
  for (let index = 0; index < localStorageMock.length; index += 1) {
    const key = localStorageMock.key(index);
    if (!key?.startsWith(prefix)) continue;
    const raw = localStorageMock.getItem(key);
    if (raw) entries.push(JSON.parse(raw) as SocialOutboxQueuedEntry);
  }
  return entries;
}

function makeOp(
  overrides: Partial<SocialOutboxRemoteOp> = {}
): SocialOutboxRemoteOp {
  return {
    kind: 'updateRow',
    databaseId: 'db',
    tableId: 'friendships',
    rowId: 'fr_friend',
    data: { status: 'accepted' },
    ...overrides,
  };
}

let restoreConsole: () => void;
beforeEach(() => {
  restoreConsole = silenceExpectedConsole(['[socialOutbox]']);
  localStorageMock.clear();
  __resetSocialOutboxForTests();
  __resetAccountWorkScopeForTests();
  scopeAccountWork('user_A');
});
afterEach(() => restoreConsole());

describe('socialOutbox — enqueue', () => {
  it('adds an entry and persists it to localStorage', () => {
    enqueueSocialOp('user_A', {
      action: 'accept_friend_request',
      op: makeOp(),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'accept_friend_request:user_B',
    });
    expect(getSocialOutboxSize('user_A')).toBe(1);
    const parsed = storedEntries();
    expect(parsed).toHaveLength(1);
    expect(parsed[0].action).toBe('accept_friend_request');
    expect(parsed[0].userId).toBe('user_A');
    expect(parsed[0].attempts).toBe(0);
  });

  it('dedups by (userId, dedupKey): same key replaces', () => {
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'send_request:user_B',
    });
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'send_request:user_B',
    });
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('preserves attempts on re-enqueue (dedup does not reset the counter)', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'send_request:user_B',
    });
    await flushSocialOutbox('user_A');
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'send_request:user_B',
    });
    const parsed = storedEntries();
    expect(parsed[0].attempts).toBe(1);
  });

  it('isolates users: same dedup key for two users keeps two entries', () => {
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp(),
      dedupKey: 'k',
    });
    enqueueSocialOp('user_B', {
      action: 'send_request',
      op: makeOp(),
      dedupKey: 'k',
    });
    expect(getSocialOutboxSize()).toBe(2);
    expect(getSocialOutboxSize('user_A')).toBe(1);
    expect(getSocialOutboxSize('user_B')).toBe(1);
  });

  it('caps total queue length at MAX_ENTRIES (100)', () => {
    for (let i = 0; i < 150; i++) {
      enqueueSocialOp('user_A', {
        action: 'send_request',
        op: makeOp(),
        dedupKey: `k-${i}`,
      });
    }
    expect(getSocialOutboxSize()).toBeLessThanOrEqual(100);
  });
});

describe('socialOutbox — flush', () => {
  it('drains successfully: entries removed after sender succeeds', async () => {
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockResolvedValue(undefined);
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow', rowId: 'fr_friend' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'k1',
    });
    enqueueSocialOp('user_A', {
      action: 'accept_friend_request',
      op: makeOp({ rowId: 'fr_friend2' }),
      revert: { myRowId: 'fr_mine2', previousStatus: 'pending_incoming' },
      dedupKey: 'k2',
    });
    await flushSocialOutbox('user_A');
    expect(sender).toHaveBeenCalledTimes(2);
    expect(getSocialOutboxSize('user_A')).toBe(0);
  });

  it('passes the op through to the sender', async () => {
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockResolvedValue(undefined);
    setSocialOutboxSender(sender);
    const op = makeOp({
      kind: 'upsertRow',
      rowId: 'fr_friend',
      data: { status: 'pending_incoming' },
      permissions: ['read("user:user_A")'],
    });
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op,
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(sender).toHaveBeenCalledWith(op);
  });

  it('drops on permanent 4xx failure (400) and emits a failure event', async () => {
    const err = Object.assign(new Error('bad request'), { code: 400 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    const events: SocialOutboxFailureEvent[] = [];
    subscribeToSocialOutboxFailures((e) => events.push(e));
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('send_request');
    expect(events[0].revert.myRowId).toBe('fr_mine');
  });

  it('drops on 404 (row gone, retrying will not help)', async () => {
    const err = Object.assign(new Error('not found'), { code: 404 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'delete_friend_pair',
      op: makeOp({ data: { deleted: true } }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(0);
  });

  it('drops on 401 and emits the failure event', async () => {
    const err = Object.assign(new Error('unauthorized'), { code: 401 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    const events: SocialOutboxFailureEvent[] = [];
    subscribeToSocialOutboxFailures((e) => events.push(e));
    enqueueSocialOp('user_A', {
      action: 'block_friend',
      op: makeOp({ data: { status: 'blocked' } }),
      revert: { myRowId: 'fr_mine', previousStatus: 'accepted' },
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].revert.previousStatus).toBe('accepted');
  });

  it('retries on 5xx: entry survives, attempts increments', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(1);
    const parsed = storedEntries();
    expect(parsed[0].attempts).toBe(1);
  });

  it('retries on 429 (rate limit)', async () => {
    const err = Object.assign(new Error('rate limit'), { code: 429 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('retries on network error (no code)', async () => {
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(new Error('network failure'));
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('drops after MAX_ATTEMPTS (5) consecutive 5xx failures and emits once', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(err);
    setSocialOutboxSender(sender);
    const events: SocialOutboxFailureEvent[] = [];
    subscribeToSocialOutboxFailures((e) => events.push(e));
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'k1',
    });
    for (let i = 0; i < 5; i++) {
      await flushSocialOutbox('user_A');
    }
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(events).toHaveLength(1);
  });

  it('does not flush another user\u2019s entries', async () => {
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockResolvedValue(undefined);
    setSocialOutboxSender(sender);
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      dedupKey: 'k1',
    });
    enqueueSocialOp('user_B', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(sender).toHaveBeenCalledTimes(1);
    expect(getSocialOutboxSize('user_B')).toBe(1);
  });

  it('is a no-op when the sender has not been set', async () => {
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op: makeOp({ kind: 'upsertRow' }),
      dedupKey: 'k1',
    });
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('is a no-op when the queue is empty', async () => {
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockResolvedValue(undefined);
    setSocialOutboxSender(sender);
    await flushSocialOutbox('user_A');
    expect(sender).not.toHaveBeenCalled();
  });
});

describe('socialOutbox — clear', () => {
  it('clear with no user clears every entry', () => {
    enqueueSocialOp('user_A', { action: 'x' as never, op: makeOp(), dedupKey: 'k' });
    enqueueSocialOp('user_B', { action: 'x' as never, op: makeOp(), dedupKey: 'k' });
    clearSocialOutbox();
    expect(getSocialOutboxSize()).toBe(0);
  });

  it('clear with a user clears only that user\u2019s entries', () => {
    enqueueSocialOp('user_A', { action: 'x' as never, op: makeOp(), dedupKey: 'k' });
    enqueueSocialOp('user_B', { action: 'x' as never, op: makeOp(), dedupKey: 'k' });
    clearSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(getSocialOutboxSize('user_B')).toBe(1);
  });
});

describe('socialOutbox — failure listeners', () => {
  it('emitSocialOutboxFailure notifies every subscriber', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeToSocialOutboxFailures(a);
    subscribeToSocialOutboxFailures(b);
    emitSocialOutboxFailure({
      userId: 'user_A',
      action: 'send_request',
      revert: { myRowId: 'fr_mine' },
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops delivery to that listener', () => {
    const a = vi.fn();
    const unsubscribe = subscribeToSocialOutboxFailures(a);
    unsubscribe();
    emitSocialOutboxFailure({
      userId: 'user_A',
      action: 'send_request',
      revert: { myRowId: 'fr_mine' },
    });
    expect(a).not.toHaveBeenCalled();
  });

  it('a throwing listener does not prevent the others', () => {
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    subscribeToSocialOutboxFailures(bad);
    subscribeToSocialOutboxFailures(good);
    emitSocialOutboxFailure({
      userId: 'user_A',
      action: 'send_request',
      revert: { myRowId: 'fr_mine' },
    });
    expect(good).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Integration: offline → enqueued → online flush → remote call made
// ---------------------------------------------------------------------------
describe('socialOutbox — offline → online integration', () => {
  it('enqueue-then-flush calls the sender with the stored op', async () => {
    // Offline: the direct write failed, so social.ts enqueues.
    const op = makeOp({ kind: 'upsertRow', rowId: 'fr_friend' });
    enqueueSocialOp('user_A', {
      action: 'send_request',
      op,
      revert: { myRowId: 'fr_mine' },
      dedupKey: 'send_request:user_B',
    });
    expect(getSocialOutboxSize('user_A')).toBe(1);

    // Online: AppLayout's tryDeliver calls flushSocialOutbox.
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockResolvedValue(undefined);
    setSocialOutboxSender(sender);
    await flushSocialOutbox('user_A');

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith(op);
    expect(getSocialOutboxSize('user_A')).toBe(0);
  });

  it('permanent 4xx on flush drops the entry and fires the revert event', async () => {
    const events: SocialOutboxFailureEvent[] = [];
    subscribeToSocialOutboxFailures((e) => events.push(e));
    enqueueSocialOp('user_A', {
      action: 'accept_friend_request',
      op: makeOp({ data: { status: 'accepted' } }),
      revert: { myRowId: 'fr_mine', previousStatus: 'pending_incoming' },
      dedupKey: 'accept_friend_request:user_B',
    });
    const sender = vi
      .fn<(op: SocialOutboxRemoteOp) => Promise<void>>()
      .mockRejectedValue(Object.assign(new Error('forbidden'), { code: 403 }));
    setSocialOutboxSender(sender);
    await flushSocialOutbox('user_A');
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: 'user_A',
      action: 'accept_friend_request',
      revert: { myRowId: 'fr_mine', previousStatus: 'pending_incoming' },
    });
  });
});
