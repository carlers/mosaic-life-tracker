import type { FriendshipDocument } from '../db/schema';

// Friend bio enrichment is optional and runs only after Home is usable.
// Keeping the worker separate prevents its queue/retry logic from entering
// Home's initial static route closure.
const BIO_BACKFILL_CONCURRENCY = 4;

type FriendBioRow = Pick<FriendshipDocument, 'id' | 'friendId'>;

export interface FriendBioBackfillServices {
  readBio(friendId: string): Promise<string | undefined>;
  writeBio(friendshipId: string, bio: string): Promise<void>;
  onError?(error: unknown, friendId: string): void;
}

const liveServices: FriendBioBackfillServices = {
  readBio: async (friendId) =>
    (await (await import('./social')).fetchProfileByUserId(friendId))?.bio,
  writeBio: async (friendshipId, bio) =>
    (await import('./social')).updateFriendBioLocally(friendshipId, bio),
  onError: (error, friendId) => {
    if (import.meta.env.DEV) {
      console.warn('[useFriendCarousel] Bio backfill failed for', friendId, error);
    }
  },
};

/** Run at most four concurrent lookups; stop on unmount or offline transition. */
export async function backfillMissingFriendBios(
  missing: readonly FriendBioRow[],
  isCancelled: () => boolean,
  services: FriendBioBackfillServices = liveServices,
): Promise<void> {
  const queue = [...missing];
  const runOne = async (): Promise<void> => {
    for (;;) {
      const friend = queue.shift();
      if (!friend || isCancelled()) return;
      try {
        const bio = await services.readBio(friend.friendId);
        if (isCancelled()) return;
        if (bio) await services.writeBio(friend.id, bio);
      } catch (error) {
        services.onError?.(error, friend.friendId);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(BIO_BACKFILL_CONCURRENCY, queue.length) }, () => runOne())
  );
}

// Friend selection stays in the optional worker instead of the Home route.
// The caller's Set retains the original per-mounted-hook once-per-session fence.
export async function backfillUntriedFriendBios(
  friends: readonly (FriendBioRow & { friendBio?: string })[],
  attempted: Set<string>,
  isCancelled: () => boolean,
  services?: FriendBioBackfillServices,
): Promise<void> {
  if (isCancelled()) return;
  const missing = friends.filter(friend => !friend.friendBio && !attempted.has(friend.friendId));
  for (const friend of missing) attempted.add(friend.friendId);
  await backfillMissingFriendBios(missing, isCancelled, services);
}
