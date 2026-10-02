import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  callbacks: new Map<string, (msg: unknown) => void>(),
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
  getDatabase: vi.fn(),
}));

import {
  startRealtime,
  __resetRealtimeForTests,
} from '../../src/db/realtime';

beforeEach(() => {
  __resetRealtimeForTests();
  state.callbacks.clear();
  vi.clearAllMocks();
});

describe('legacy realtime ownership', () => {
  it('owns no collection after the message RxDB handoff', () => {
    startRealtime('alice');
    expect([...state.callbacks.keys()]).toEqual([]);
  });
});
