import { describe, it, expect, beforeEach, vi } from 'vitest';
const localStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  const mock = {
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
  enqueueMessageAction,
  flushMessageActionQueue,
  clearMessageActionQueue,
  getMessageActionQueueSize,
  setMessageActionSender,
  __resetQueueForTests,
} from '../../src/lib/messageActionQueue';
const STORAGE_KEY = 'mosaic_message_action_queue';
beforeEach(() => {
  localStorageMock.clear();
  __resetQueueForTests();
});
describe('messageActionQueue — enqueue', () => {
  it('adds an entry and persists it to localStorage', () => {
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: { partnerId: 'user_B', threadId: 'th_x' },
      dedupKey: 'mark_read:th_x',
    });
    expect(getMessageActionQueueSize('user_A')).toBe(1);
    const raw = localStorageMock.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].action).toBe('mark_read');
    expect(parsed[0].userId).toBe('user_A');
    expect(parsed[0].attempts).toBe(0);
  });
  it('dedups by (userId, dedupKey): same key replaces', () => {
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: { partnerId: 'user_B', threadId: 'th_x' },
      dedupKey: 'mark_read:th_x',
    });
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: { partnerId: 'user_B', threadId: 'th_x' },
      dedupKey: 'mark_read:th_x',
    });
    expect(getMessageActionQueueSize('user_A')).toBe(1);
  });
  it('isolates users: same dedup key for two users keeps two entries', () => {
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k',
    });
    enqueueMessageAction('user_B', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k',
    });
    expect(getMessageActionQueueSize()).toBe(2);
    expect(getMessageActionQueueSize('user_A')).toBe(1);
    expect(getMessageActionQueueSize('user_B')).toBe(1);
  });
  it('caps total queue length at MAX_ENTRIES (100)', () => {
    for (let i = 0; i < 150; i++) {
      enqueueMessageAction('user_A', {
        action: 'mark_read',
        payload: { i },
        dedupKey: `k-${i}`,
      });
    }
    expect(getMessageActionQueueSize()).toBeLessThanOrEqual(100);
  });
});
describe('messageActionQueue — flush', () => {
  it('drains successfully: entries removed after sender succeeds', async () => {
    const sender = vi.fn().mockResolvedValue({});
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: { partnerId: 'user_B', threadId: 'th_x' },
      dedupKey: 'k1',
    });
    enqueueMessageAction('user_A', {
      action: 'unsend',
      payload: { messageId: 'msg_1', recipientId: 'user_B' },
      dedupKey: 'k2',
    });
    await flushMessageActionQueue('user_A');
    expect(sender).toHaveBeenCalledTimes(2);
    expect(getMessageActionQueueSize('user_A')).toBe(0);
  });
  it('passes the action and payload to the sender', async () => {
    const sender = vi.fn().mockResolvedValue({});
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: { partnerId: 'user_B', threadId: 'th_x' },
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(sender).toHaveBeenCalledWith({
      action: 'mark_read',
      partnerId: 'user_B',
      threadId: 'th_x',
    });
  });
  it('drops on permanent 4xx failure (400)', async () => {
    const err = Object.assign(new Error('bad request'), { code: 400 });
    const sender = vi.fn().mockRejectedValue(err);
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(0);
  });
  it('drops on 404 (row gone, retrying will not help)', async () => {
    const err = Object.assign(new Error('not found'), { code: 404 });
    const sender = vi.fn().mockRejectedValue(err);
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'unsend',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(0);
  });
  it('drops on 401 (auth failure, dispatch handled elsewhere)', async () => {
    const err = Object.assign(new Error('unauthorized'), { code: 401 });
    const sender = vi.fn().mockRejectedValue(err);
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(0);
  });
  it('retries on 5xx: entry survives, attempts increments', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const sender = vi.fn().mockRejectedValue(err);
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(1);
    const raw = localStorageMock.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed[0].attempts).toBe(1);
  });
  it('retries on 429 (rate limit)', async () => {
    const err = Object.assign(new Error('rate limit'), { code: 429 });
    const sender = vi.fn().mockRejectedValue(err);
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(1);
  });
  it('retries on network error (no code)', async () => {
    const sender = vi.fn().mockRejectedValue(new Error('network failure'));
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(1);
  });
  it('drops after MAX_ATTEMPTS (5) consecutive 5xx failures', async () => {
    const err = Object.assign(new Error('server boom'), { code: 500 });
    const sender = vi.fn().mockRejectedValue(err);
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    for (let i = 0; i < 5; i++) {
      await flushMessageActionQueue('user_A');
    }
    expect(getMessageActionQueueSize('user_A')).toBe(0);
  });
  it('does not flush another user\u2019s entries', async () => {
    const sender = vi.fn().mockResolvedValue({});
    setMessageActionSender(sender);
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    enqueueMessageAction('user_B', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(sender).toHaveBeenCalledTimes(1);
    expect(getMessageActionQueueSize('user_B')).toBe(1);
  });
  it('is a no-op when the sender has not been set', async () => {
    enqueueMessageAction('user_A', {
      action: 'mark_read',
      payload: {},
      dedupKey: 'k1',
    });
    await flushMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(1);
  });
  it('is a no-op when the queue is empty', async () => {
    const sender = vi.fn().mockResolvedValue({});
    setMessageActionSender(sender);
    await flushMessageActionQueue('user_A');
    expect(sender).not.toHaveBeenCalled();
  });
});
describe('messageActionQueue — clear', () => {
  it('clear with no user clears every entry', () => {
    enqueueMessageAction('user_A', {
      action: 'x',
      payload: {},
      dedupKey: 'k',
    });
    enqueueMessageAction('user_B', {
      action: 'x',
      payload: {},
      dedupKey: 'k',
    });
    clearMessageActionQueue();
    expect(getMessageActionQueueSize()).toBe(0);
  });
  it('clear with a user clears only that user\u2019s entries', () => {
    enqueueMessageAction('user_A', {
      action: 'x',
      payload: {},
      dedupKey: 'k',
    });
    enqueueMessageAction('user_B', {
      action: 'x',
      payload: {},
      dedupKey: 'k',
    });
    clearMessageActionQueue('user_A');
    expect(getMessageActionQueueSize('user_A')).toBe(0);
    expect(getMessageActionQueueSize('user_B')).toBe(1);
  });
});
