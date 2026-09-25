import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { silenceExpectedConsole } from '../helpers/expectedConsole';

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

const sdkRef = vi.hoisted(() => ({
  upsertRow: vi.fn(),
  updateRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
}));

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    upsertRow: sdkRef.upsertRow,
    updateRow: sdkRef.updateRow,
    getRow: sdkRef.getRow,
    listRows: sdkRef.listRows,
  },
  guardedStorage: {},
  guardedFunctions: {},
  guardedAccount: {},
}));

const dbRef = vi.hoisted(() => ({
  upsert: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    friendships: {
      upsert: dbRef.upsert,
      findOne: (id: string) => ({
        exec: async () => dbRef.findOne(id),
      }),
    },
  }),
}));

import {
  sendFriendRequest,
  acceptFriendRequest,
  createOrUpdateProfile,
} from '../../src/lib/social';
import {
  __resetSocialOutboxForTests,
  getSocialOutboxSize,
  subscribeToSocialOutboxFailures,
  type SocialOutboxFailureEvent,
} from '../../src/lib/socialOutbox';
import { isOfflineError } from '../../src/lib/authEvents';
import type { ProfileCard } from '../../src/lib/social';

const FRIEND: ProfileCard = {
  $id: 'profile_user_B',
  user_id: 'user_B',
  username: 'friend_b',
  display_name: 'Friend B',
  avatar_file_id: '',
  bio: '',
  is_searchable: true,
};

let restoreConsole: () => void;
beforeEach(() => {
  restoreConsole = silenceExpectedConsole(['[social]']);
  localStorageMock.clear();
  __resetSocialOutboxForTests();
  sdkRef.upsertRow.mockReset();
  sdkRef.updateRow.mockReset();
  dbRef.upsert.mockReset();
  dbRef.upsert.mockResolvedValue(undefined);
  dbRef.findOne.mockReset();
  dbRef.findOne.mockResolvedValue(null);
});
afterEach(() => restoreConsole());

describe('social.sendFriendRequest — offline resilience (OFF-8)', () => {
  it('local write happens first, remote failure enqueues into the outbox', async () => {
    sdkRef.upsertRow.mockRejectedValueOnce(new Error('Network down'));
    await sendFriendRequest({
      myUserId: 'user_A',
      myUsername: 'me_a',
      myDisplayName: 'Me A',
      myAvatarFileId: '',
      myBio: '',
      friend: FRIEND,
    });
    expect(dbRef.upsert).toHaveBeenCalledTimes(1);
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('online happy path does not enqueue', async () => {
    sdkRef.upsertRow.mockResolvedValueOnce({ $id: 'fr_x' });
    await sendFriendRequest({
      myUserId: 'user_A',
      myUsername: 'me_a',
      myDisplayName: 'Me A',
      myAvatarFileId: '',
      myBio: '',
      friend: FRIEND,
    });
    expect(getSocialOutboxSize('user_A')).toBe(0);
  });

  it('permanent failure does not enqueue and fires the revert event', async () => {
    const events: SocialOutboxFailureEvent[] = [];
    subscribeToSocialOutboxFailures((e) => events.push(e));
    sdkRef.upsertRow.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { code: 403 })
    );
    await sendFriendRequest({
      myUserId: 'user_A',
      myUsername: 'me_a',
      myDisplayName: 'Me A',
      myAvatarFileId: '',
      myBio: '',
      friend: FRIEND,
    });
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('send_request');
    expect(events[0].revert.myRowId).not.toBe('');
  });
});

describe('social.acceptFriendRequest — offline resilience (OFF-9)', () => {
  it('transient remote failure enqueues; local patch already applied', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    dbRef.findOne.mockResolvedValueOnce({
      status: 'pending_incoming',
      patch,
    });
    sdkRef.updateRow.mockRejectedValueOnce(new Error('Network down'));
    await acceptFriendRequest('user_A', 'user_B');
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'accepted' })
    );
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('permanent failure fires the revert event with the previous status', async () => {
    const events: SocialOutboxFailureEvent[] = [];
    subscribeToSocialOutboxFailures((e) => events.push(e));
    const patch = vi.fn().mockResolvedValue(undefined);
    dbRef.findOne.mockResolvedValueOnce({
      status: 'pending_incoming',
      patch,
    });
    sdkRef.updateRow.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { code: 403 })
    );
    await acceptFriendRequest('user_A', 'user_B');
    expect(getSocialOutboxSize('user_A')).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('accept_friend_request');
    expect(events[0].revert.previousStatus).toBe('pending_incoming');
  });
});

describe('social.createOrUpdateProfile — offline resilience (OFF-10)', () => {
  it('transient failure enqueues and throws a distinguishable Offline error', async () => {
    sdkRef.upsertRow.mockRejectedValueOnce(new Error('Network down'));
    let caught: unknown = null;
    try {
      await createOrUpdateProfile({
        userId: 'user_A',
        username: 'me_a',
        displayName: 'Me A',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(isOfflineError(caught)).toBe(true);
    expect(getSocialOutboxSize('user_A')).toBe(1);
  });

  it('online happy path does not enqueue and returns the row', async () => {
    sdkRef.upsertRow.mockResolvedValueOnce({
      $id: 'profile_user_A',
      user_id: 'user_A',
      username: 'me_a',
      display_name: 'Me A',
      avatar_file_id: '',
      bio: '',
      is_searchable: true,
    });
    const p = await createOrUpdateProfile({
      userId: 'user_A',
      username: 'me_a',
      displayName: 'Me A',
    });
    expect(p.username).toBe('me_a');
    expect(getSocialOutboxSize('user_A')).toBe(0);
  });

  it('permanent failure throws the original error and does not enqueue', async () => {
    sdkRef.upsertRow.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { code: 403 })
    );
    await expect(
      createOrUpdateProfile({
        userId: 'user_A',
        username: 'me_a',
        displayName: 'Me A',
      })
    ).rejects.toThrow(/forbidden/);
    expect(getSocialOutboxSize('user_A')).toBe(0);
  });
});
