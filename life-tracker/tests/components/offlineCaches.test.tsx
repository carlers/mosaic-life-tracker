import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPendingImage,
  deletePendingImage,
  getPendingImage,
} from '../../src/lib/pendingImages';
import {
  getCachedCalendar,
  setCachedCalendar,
  type FriendCalendarBundle,
} from '../../src/lib/friendCache';
import {
  clearAllCachedOwnProfiles,
  readCachedOwnProfile,
  writeCachedOwnProfile,
} from '../../src/lib/profileCache';
import type { ProfileCard } from '../../src/lib/social';

function bundle(friendUserId: string, title: string): FriendCalendarBundle {
  return {
    friendUserId,
    fetchedAt: new Date().toISOString(),
    categories: [],
    tasks: [
      {
        id: 'task_cache',
        userId: friendUserId,
        title,
        completed: false,
        categoryId: '',
        date: '2026-09-27',
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
        isDeleted: false,
        visibility: 'private',
      },
    ],
  };
}

describe('offline auxiliary caches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps pending image blobs owner scoped', async () => {
    const id = await createPendingImage(
      'user_A',
      new Blob(['photo'], { type: 'image/webp' })
    );

    expect(await getPendingImage(id, 'user_A')).toBeInstanceOf(Blob);
    expect(await getPendingImage(id, 'user_B')).toBeNull();

    await deletePendingImage(id, 'user_B');
    expect(await getPendingImage(id, 'user_A')).toBeInstanceOf(Blob);

    await deletePendingImage(id, 'user_A');
    expect(await getPendingImage(id, 'user_A')).toBeNull();
  });

  it('isolates the same friend calendar between local Mosaic accounts', async () => {
    await setCachedCalendar('user_A', bundle('friend_1', 'A copy'));
    await setCachedCalendar('user_B', bundle('friend_1', 'B copy'));

    expect(
      (await getCachedCalendar('user_A', 'friend_1'))?.tasks[0].title
    ).toBe('A copy');
    expect(
      (await getCachedCalendar('user_B', 'friend_1'))?.tasks[0].title
    ).toBe('B copy');
  });

  it('keeps own-profile cache keyed to its owner', () => {
    const profile = {
      $id: 'profile_user_A',
      user_id: 'user_A',
      username: 'user_a',
      display_name: 'User A',
      avatar_file_id: '',
      bio: '',
      is_searchable: true,
    } as ProfileCard;
    writeCachedOwnProfile('user_A', profile);

    expect(readCachedOwnProfile('user_A')?.username).toBe('user_a');
    expect(readCachedOwnProfile('user_B')).toBeNull();

    clearAllCachedOwnProfiles();
    expect(readCachedOwnProfile('user_A')).toBeNull();
  });
});
