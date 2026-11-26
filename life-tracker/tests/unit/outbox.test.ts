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

import { createPersistentOutbox, type OutboxEntryBase } from '../../src/lib/outbox';
import { isExactEncryptionCutoverError } from '../../src/lib/encryptionCutover';

interface TestEntry extends OutboxEntryBase {
  payload: { n: number };
}

function storedEntries(storageKey = 'test_outbox'): TestEntry[] {
  const prefix = storageKey + ':entry:';
  const entries: TestEntry[] = [];
  for (let index = 0; index < localStorageMock.length; index += 1) {
    const key = localStorageMock.key(index);
    if (!key?.startsWith(prefix)) continue;
    const raw = localStorageMock.getItem(key);
    if (raw) entries.push(JSON.parse(raw) as TestEntry);
  }
  return entries;
}

function makeOutbox(
  send = vi.fn<(input: { n: number }) => Promise<void>>().mockResolvedValue(undefined),
  preserveOnEncryptionCutover = false
) {
  const dropSpy = vi.fn();
  const outbox = createPersistentOutbox<
    { n: number },
    { n: number },
    TestEntry
  >({
    storageKey: 'test_outbox',
    logPrefix: '[testOutbox]',
    preserveOnEncryptionCutover: preserveOnEncryptionCutover ? isExactEncryptionCutoverError : undefined,
    makeEntry: (input, previousAttempts) => ({
      id: input.dedupKey,
      userId: input.userId,
      action: input.action,
      payload: input.payload,
      attempts: previousAttempts,
      enqueuedAt: new Date().toISOString(),
    }),
    parseEntry: (raw) => {
      if (
        !!raw &&
        typeof raw === 'object' &&
        typeof (raw as TestEntry).id === 'string' &&
        typeof (raw as TestEntry).userId === 'string' &&
        typeof (raw as TestEntry).action === 'string' &&
        typeof (raw as TestEntry).attempts === 'number' &&
        typeof (raw as TestEntry).enqueuedAt === 'string' &&
        typeof (raw as TestEntry).payload === 'object'
      ) {
        return raw as TestEntry;
      }
      return null;
    },
    send,
    toSendInput: (entry) => entry.payload,
    onDrop: dropSpy,
  });
  // Wire a sender that delegates to `send` so tests can drive failure paths.
  outbox.setSender(async (entry) => {
    await send(entry.payload);
  });
  return { outbox, send, dropSpy };
}

let restoreConsole: () => void;
beforeEach(() => {
  restoreConsole = silenceExpectedConsole(['[testOutbox]']);
  localStorageMock.clear();
});
afterEach(() => restoreConsole());

describe('outbox — enqueue', () => {
  it('adds an entry and persists it to localStorage', () => {
    const { outbox } = makeOutbox();
    outbox.enqueue('user_A', {
      action: 'test',
      payload: { n: 1 },
      dedupKey: 'k1',
    });
    expect(outbox.size('user_A')).toBe(1);
    const parsed = storedEntries();
    expect(parsed).toHaveLength(1);
    expect(parsed[0].action).toBe('test');
    expect(parsed[0].userId).toBe('user_A');
    expect(parsed[0].attempts).toBe(0);
  });

  it('dedups by (userId, dedupKey): same key replaces', () => {
    const { outbox } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'k' });
    outbox.enqueue('user_A', { action: 'test', payload: { n: 2 }, dedupKey: 'k' });
    expect(outbox.size('user_A')).toBe(1);
  });

  it('isolates users: same dedup key keeps two entries', () => {
    const { outbox } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'k' });
    outbox.enqueue('user_B', { action: 'test', payload: { n: 1 }, dedupKey: 'k' });
    expect(outbox.size()).toBe(2);
    expect(outbox.size('user_A')).toBe(1);
    expect(outbox.size('user_B')).toBe(1);
  });

  it('rejects capacity overflow without losing any of the first 100 entries', () => {
    const { outbox } = makeOutbox();
    for (let i = 0; i < 100; i++) {
      outbox.enqueue('user_A', {
        action: 'test',
        payload: { n: i },
        dedupKey: `a-${i}`,
      });
    }
    expect(() => outbox.enqueue('user_A', {
      action: 'test', payload: { n: 101 }, dedupKey: 'overflow',
    })).toThrow('queue full');
    for (let i = 0; i < 100; i++) {
      outbox.enqueue('user_B', {
        action: 'test',
        payload: { n: i },
        dedupKey: `b-${i}`,
      });
    }
    expect(outbox.size('user_A')).toBe(100);
    expect(outbox.size('user_B')).toBe(100);
    expect(outbox.size()).toBe(200);
  });

  it('preserves attempts on re-enqueue (dedup does not reset the counter)', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const send = vi
      .fn<(input: { n: number }) => Promise<void>>()
      .mockRejectedValue(err);
    const { outbox } = makeOutbox(send);
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'k' });
    await outbox.flush('user_A');
    outbox.enqueue('user_A', { action: 'test', payload: { n: 2 }, dedupKey: 'k' });
    const parsed = storedEntries();
    expect(parsed[0].attempts).toBe(1);
  });
});

describe('outbox — flush', () => {
  it('does not lose a different-tab enqueue while a flush is in flight', async () => {
    let releaseSend: (() => void) | null = null;
    const send = vi.fn<(input: { n: number }) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          releaseSend = resolve;
        })
    );
    const first = makeOutbox(send).outbox;
    const second = makeOutbox().outbox;

    first.enqueue('user_A', {
      action: 'test',
      payload: { n: 1 },
      dedupKey: 'first',
    });
    const flushing = first.flush('user_A');
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    second.enqueue('user_A', {
      action: 'test',
      payload: { n: 2 },
      dedupKey: 'second',
    });

    releaseSend?.();
    await flushing;

    expect(second.size('user_A')).toBe(1);
    expect(storedEntries()).toEqual([
      expect.objectContaining({ id: 'second', payload: { n: 2 } }),
    ]);
  });

  it('keeps a newer same-key enqueue when an older send finishes', async () => {
    let releaseSend: (() => void) | null = null;
    const send = vi.fn<(input: { n: number }) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          releaseSend = resolve;
        })
    );
    const first = makeOutbox(send).outbox;
    const second = makeOutbox().outbox;

    first.enqueue('user_A', {
      action: 'test',
      payload: { n: 1 },
      dedupKey: 'same',
    });
    const flushing = first.flush('user_A');
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    second.enqueue('user_A', {
      action: 'test',
      payload: { n: 2 },
      dedupKey: 'same',
    });

    releaseSend?.();
    await flushing;

    expect(storedEntries()).toEqual([
      expect.objectContaining({ id: 'same', payload: { n: 2 } }),
    ]);
  });

  it('drains successfully: entries removed after send succeeds', async () => {
    const { outbox, send } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    outbox.enqueue('user_A', { action: 'test', payload: { n: 2 }, dedupKey: 'b' });
    await outbox.flush('user_A');
    expect(send).toHaveBeenCalledTimes(2);
    expect(outbox.size('user_A')).toBe(0);
  });

  it('passes the payload through toSendInput', async () => {
    const { outbox, send } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 42 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(send).toHaveBeenCalledWith({ n: 42 });
  });

  it('drops on permanent 4xx failure (400)', async () => {
    const err = Object.assign(new Error('bad request'), { code: 400 });
    const { outbox, dropSpy } = makeOutbox(
      vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err)
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(outbox.size('user_A')).toBe(0);
    expect(dropSpy).toHaveBeenCalledTimes(1);
  });

  it('drops on 404 (row gone, retrying will not help)', async () => {
    const err = Object.assign(new Error('not found'), { code: 404 });
    const { outbox } = makeOutbox(
      vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err)
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(outbox.size('user_A')).toBe(0);
  });

  it('drops on 401 (auth failure)', async () => {
    const err = Object.assign(new Error('unauthorized'), { code: 401 });
    const { outbox } = makeOutbox(
      vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err)
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(outbox.size('user_A')).toBe(0);
  });

  it('retries on 5xx: entry survives, attempts increments', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const { outbox } = makeOutbox(
      vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err)
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(outbox.size('user_A')).toBe(1);
    const parsed = storedEntries();
    expect(parsed[0].attempts).toBe(1);
  });

  it('retries on 429 (rate limit)', async () => {
    const err = Object.assign(new Error('rate limit'), { code: 429 });
    const { outbox } = makeOutbox(
      vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err)
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(outbox.size('user_A')).toBe(1);
  });

  it('retries on network error (no code)', async () => {
    const { outbox } = makeOutbox(
      vi
        .fn<(input: { n: number }) => Promise<void>>()
        .mockRejectedValue(new Error('network failure'))
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(outbox.size('user_A')).toBe(1);
  });

  it('drops after MAX_ATTEMPTS (5) consecutive 5xx failures and fires onDrop once', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const { outbox, dropSpy } = makeOutbox(
      vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err)
    );
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    for (let i = 0; i < 5; i++) {
      await outbox.flush('user_A');
    }
    expect(outbox.size('user_A')).toBe(0);
    expect(dropSpy).toHaveBeenCalledTimes(1);
  });

  it('does not flush another user\u2019s entries', async () => {
    const { outbox, send } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    outbox.enqueue('user_B', { action: 'test', payload: { n: 2 }, dedupKey: 'b' });
    await outbox.flush('user_A');
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox.size('user_B')).toBe(1);
  });

  it('is a no-op when the queue is empty', async () => {
    const { outbox, send } = makeOutbox();
    await outbox.flush('user_A');
    expect(send).not.toHaveBeenCalled();
  });

  it('single in-flight flush: a concurrent flush call is ignored', async () => {
    let resolveSend: (() => void) | null = null;
    const send = vi.fn<(input: { n: number }) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        })
    );
    const { outbox } = makeOutbox(send);
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    const first = outbox.flush('user_A');
    const second = outbox.flush('user_A');
    if (resolveSend) (resolveSend as () => void)();
    await Promise.all([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a throwing onDrop does not break the flush loop', async () => {
    const err = Object.assign(new Error('bad request'), { code: 400 });
    const dropSpy = vi.fn(() => {
      throw new Error('onDrop boom');
    });
    const send = vi
      .fn<(input: { n: number }) => Promise<void>>()
      .mockRejectedValue(err);
    const outbox = createPersistentOutbox<
      { n: number },
      { n: number },
      TestEntry
    >({
      storageKey: 'test_outbox',
      logPrefix: '[testOutbox]',
      makeEntry: (input, previousAttempts) => ({
        id: input.dedupKey,
        userId: input.userId,
        action: input.action,
        payload: input.payload,
        attempts: previousAttempts,
        enqueuedAt: new Date().toISOString(),
      }),
      parseEntry: (raw) => (raw as TestEntry) ?? null,
      send,
      toSendInput: (entry) => entry.payload,
      onDrop: dropSpy,
    });
    outbox.setSender(async (entry) => {
      await send(entry.payload);
    });
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    await outbox.flush('user_A');
    expect(dropSpy).toHaveBeenCalledTimes(1);
    expect(outbox.size('user_A')).toBe(0);
  });
});

describe('outbox — clear', () => {
  it('clear with no user clears every entry', () => {
    const { outbox } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    outbox.enqueue('user_B', { action: 'test', payload: { n: 2 }, dedupKey: 'b' });
    outbox.clear();
    expect(outbox.size()).toBe(0);
  });

  it('clear with a user clears only that user\u2019s entries', () => {
    const { outbox } = makeOutbox();
    outbox.enqueue('user_A', { action: 'test', payload: { n: 1 }, dedupKey: 'a' });
    outbox.enqueue('user_B', { action: 'test', payload: { n: 2 }, dedupKey: 'b' });
    outbox.clear('user_A');
    expect(outbox.size('user_A')).toBe(0);
    expect(outbox.size('user_B')).toBe(1);
  });
});


describe('outbox — fail-closed local storage', () => {
  it('throws on quota denial without treating a phantom enqueue as queued', () => {
    const {outbox} = makeOutbox();
    const original = localStorageMock.setItem;
    localStorageMock.setItem = () => { throw new Error('quota exceeded'); };
    try {
      expect(() => outbox.enqueue('user_A', {
        action: 'test', payload: { n: 1 }, dedupKey: 'quota',
      })).toThrow('queue unavailable');
      expect(outbox.size('user_A')).toBe(0);
    } finally {
      localStorageMock.setItem = original;
    }
  });

  it('rejects fresh enqueues while a malformed older queue remains for recovery', () => {
    const {outbox} = makeOutbox();
    const raw = JSON.stringify([{ unrecognizedVersion: 7 }]);
    localStorageMock.setItem('test_outbox', raw);
    expect(() => outbox.enqueue('user_A', {
      action: 'test', payload: { n: 1 }, dedupKey: 'next',
    })).toThrow('queue recovery required');
    expect(localStorageMock.getItem('test_outbox')).toBe(raw);
    expect(outbox.size('user_A')).toBe(0);
  });

  it('does not overwrite an unrecognized legacy per-entry payload', () => {
    const {outbox} = makeOutbox();
    const key = 'test_outbox:entry:user_A:old';
    localStorageMock.setItem(key, '{unknown_version}');
    expect(() => outbox.enqueue('user_A', {
      action: 'test', payload: { n: 1 }, dedupKey: 'old',
    })).toThrow('queue recovery required');
    expect(localStorageMock.getItem(key)).toBe('{unknown_version}');
  });

  it('does not remove a legacy array if any entry is malformed or migration cannot persist', () => {
    const {outbox} = makeOutbox();
    const valid = {id:'old',userId:'user_A',action:'test',payload:{n:1},
      enqueuedAt:'2026-11-26T00:00:00.000Z',attempts:0};
    const key='test_outbox';
    localStorageMock.setItem(key, JSON.stringify([valid,{unsupportedVersion:2}]));
    expect(outbox.size('user_A')).toBe(1);
    expect(localStorageMock.getItem(key)).not.toBeNull();
    localStorageMock.clear();
    localStorageMock.setItem(key, JSON.stringify([valid]));
    const original = localStorageMock.setItem;
    localStorageMock.setItem = (k,v) => {
      if (k.startsWith('test_outbox:entry:')) throw new Error('quota');
      original(k,v);
    };
    try {
      expect(outbox.size('user_A')).toBe(0);
      expect(localStorageMock.getItem(key)).not.toBeNull();
    } finally {
      localStorageMock.setItem=original;
    }
  });
});

describe('outbox — signed E2EE cutover preservation', () => {
  it('recognizes only the exact HTTP 409 cutover error', () => {
    expect(isExactEncryptionCutoverError({ code: 409, result: { error: 'Legacy action unavailable during encryption' } })).toBe(true);
    expect(isExactEncryptionCutoverError({ code: 409, result: { error: 'Conflict' } })).toBe(false);
    expect(isExactEncryptionCutoverError({ code: 403, result: { error: 'Legacy action unavailable during encryption' } })).toBe(false);
  });
  it('holds the owner queue across reload, no dropped intent, no replay, no new enqueue', async () => {
    const err = Object.assign(new Error('cutover'), { code: 409, result: { error: 'Legacy action unavailable during encryption' } });
    const send = vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err);
    const { outbox, dropSpy } = makeOutbox(send, true);
    outbox.enqueue('user_A', { action: 'old', payload: { n: 1 }, dedupKey: 'a' });
    outbox.enqueue('user_A', { action: 'old', payload: { n: 2 }, dedupKey: 'b' });
    outbox.enqueue('user_B', { action: 'ok', payload: { n: 3 }, dedupKey: 'c' });
    await outbox.flush('user_A');
    expect(send).toHaveBeenCalledTimes(1);
    expect(storedEntries().filter(e => e.userId === 'user_A')).toHaveLength(2);
    expect(storedEntries().find(e => e.id === 'a')?.encryptionCutoverHold).toBe(true);
    expect(dropSpy).not.toHaveBeenCalled();
    outbox.resetForTests();
    await outbox.flush('user_A');
    expect(send).toHaveBeenCalledTimes(1);
    expect(() => outbox.enqueue('user_A', { action: 'new', payload: { n: 4 }, dedupKey: 'd' })).toThrow('secure recovery');
    expect(storedEntries().filter(e => e.userId === 'user_A')).toHaveLength(2);
    send.mockResolvedValue(undefined);
    await outbox.flush('user_B');
    expect(outbox.size('user_B')).toBe(0);
  });
});


describe('outbox — historical malformed entry non-destruction', () => {
  it('does not delete unreadable legacy queue bytes during an ordinary read', () => {
    const outbox = makeOutbox().outbox;
    const legacyKey = 'test_outbox:entry:user_A:pending';
    localStorageMock.setItem(legacyKey, '{unrecognized-old-payload');
    localStorageMock.setItem('test_outbox', JSON.stringify({ unknownVersion: 99 }));
    expect(outbox.size('user_A')).toBe(0);
    expect(localStorageMock.getItem(legacyKey)).toBe('{unrecognized-old-payload');
    expect(localStorageMock.getItem('test_outbox')).not.toBeNull();
  });
});


describe('outbox — exhausted transient retries are recoverable on encrypted queues', () => {
  it('holds, rather than drops, after five 5xx responses and refuses auto-replay after reload', async () => {
    const err = Object.assign(new Error('transient'), { code: 503 });
    const send = vi.fn<(input: { n: number }) => Promise<void>>().mockRejectedValue(err);
    const { outbox, dropSpy } = makeOutbox(send, true);
    outbox.enqueue('user_A', { action:'test',payload:{ n:1 },dedupKey:'a' });
    outbox.enqueue('user_A', { action:'test',payload:{ n:2 },dedupKey:'b' });
    for (let i=0;i<5;i++) await outbox.flush('user_A');
    expect(send).toHaveBeenCalledTimes(5);
    expect(dropSpy).not.toHaveBeenCalled();
    expect(outbox.size('user_A')).toBe(2);
    expect(storedEntries().find(e=>e.id==='a')?.deliveryHold).toBe(true);
    expect(storedEntries().find(e=>e.id==='a')?.attempts).toBe(5);
    outbox.resetForTests();
    await outbox.flush('user_A');
    expect(send).toHaveBeenCalledTimes(5);
    expect(() => outbox.enqueue('user_A',{
      action:'test',payload:{ n:3 },dedupKey:'c',
    })).toThrow('secure recovery');
    expect(outbox.size('user_A')).toBe(2);
  });
});
