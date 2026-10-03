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
  send = vi.fn<(input: { n: number }) => Promise<void>>().mockResolvedValue(undefined)
) {
  const dropSpy = vi.fn();
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

  it('caps each account independently at 100 entries', () => {
    const { outbox } = makeOutbox();
    for (let i = 0; i < 125; i++) {
      outbox.enqueue('user_A', {
        action: 'test',
        payload: { n: i },
        dedupKey: `a-${i}`,
      });
    }
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
