import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  callbacks: new Map<string, (msg: unknown) => void>(),
  insert: vi.fn(),
  find: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedRealtime: {
    subscribe: (channel: string, callback: (msg: unknown) => void) => {
      state.callbacks.set(channel, callback);
      return () => {};
    },
  },
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    friendships: {
      findOne: () => ({ exec: state.find }),
      upsert: state.insert,
    },
  }),
}));

import {
  startRealtime,
  stopRealtime,
  __resetRealtimeForTests,
} from '../../src/db/realtime';

const event = (owner: string) => ({
  events: [
    'databases.life_tracker.tables.friendships.rows.fr_request.create',
  ],
  payload: {
    $id: 'fr_request',
    user_id: owner,
    friend_id: 'peer',
    status: 'pending_incoming',
    deleted: false,
    updated_at: '2026-09-28T00:00:00.000Z',
  },
});

function friendshipCallback() {
  const entry = [...state.callbacks.entries()].find(([channel]) =>
    channel.includes('.friendships.')
  );
  if (!entry) throw new Error('friendship realtime callback missing');
  return entry[1];
}

beforeEach(() => {
  __resetRealtimeForTests();
  state.callbacks.clear();
  vi.clearAllMocks();
  state.find.mockResolvedValue(null);
});

describe('friendship realtime isolation', () => {
  it('receives the active owner incoming request and rejects other owners', async () => {
    startRealtime('alice');
    const callback = friendshipCallback();
    callback(event('mallory'));
    callback(event('alice'));
    await vi.waitFor(() =>
      expect(state.insert).toHaveBeenCalledTimes(1)
    );
    expect(state.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'alice',
        status: 'pending_incoming',
      })
    );
  });

  it('leaves categories and diary to their RxDB replication pilots', () => {
    startRealtime('alice');
    const channels = [...state.callbacks.keys()];
    expect(
      channels.some((channel) => channel.includes('.categories.'))
    ).toBe(false);
    expect(
      channels.some((channel) => channel.includes('.diary.'))
    ).toBe(false);
  });

  it('drops old subscription events after logout/account switching', async () => {
    startRealtime('alice');
    const old = friendshipCallback();
    stopRealtime();
    startRealtime('bob');
    old(event('alice'));
    await Promise.resolve();
    expect(state.insert).not.toHaveBeenCalled();
  });

  it('drops in-flight row reads if the active account changes', async () => {
    let resolve!: (value: unknown) => void;
    state.find.mockImplementation(
      () =>
        new Promise((next) => {
          resolve = next;
        })
    );
    startRealtime('alice');
    friendshipCallback()(event('alice'));
    startRealtime('bob');
    resolve(null);
    await Promise.resolve();
    expect(state.insert).not.toHaveBeenCalled();
  });
});
