import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import {
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendPair,
  blockFriend,
  type ProfileCard,
} from '../lib/social';
import { clearCachedCalendar } from '../lib/friendCache';
import type { FriendshipDocument } from '../db/schema';
import type { MyProfileInput } from '../lib/social';

export interface UseFriendsReturn {
  friends: FriendshipDocument[];
  incomingRequests: FriendshipDocument[];
  outgoingRequests: FriendshipDocument[];
  blockedUsers: FriendshipDocument[];
  isLoading: boolean;
  sendRequest: (
    myProfile: Omit<MyProfileInput, 'userId'>,
    friend: ProfileCard
  ) => Promise<void>;
  accept: (friendUserId: string) => Promise<void>;
  decline: (friendUserId: string) => Promise<void>;
  cancel: (friendUserId: string) => Promise<void>;
  remove: (friendUserId: string) => Promise<void>;
  block: (friendUserId: string) => Promise<void>;
  findFriendship: (friendUserId: string) => FriendshipDocument | undefined;
}

export function useFriends(): UseFriendsReturn {
  const { user } = useAuth();
  const userId = user?.$id;
  const [rows, setRows] = useState<FriendshipDocument[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    let subscription: { unsubscribe: () => void } | undefined;
    let isMounted = true;

    async function init() {
      try {
        const db = getDatabase();

        // Legacy cleanup: pre-hash rows (41-char IDs) fail Appwrite's 36-char limit
        const allMine = await db.friendships
          .find({ selector: { userId: uid } })
          .exec();
        for (const doc of allMine) {
          if (doc.id.length > 36 && doc.id.includes('_')) {
            if (import.meta.env.DEV) {
              console.log('[useFriends] Removing legacy friendship row:', doc.id);
            }
            await doc.remove();
          }
        }

        const query = db.friendships.find({
          selector: { userId: uid, isDeleted: false },
          sort: [{ updatedAt: 'desc' }],
        });
        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          setRows(docs as FriendshipDocument[]);
          setLoadedUserId(uid);
        });
        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (error) {
        console.error('[useFriends] Error loading friendships:', error);
        if (isMounted) setLoadedUserId(uid);
      }
    }

    init();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);

  const friends = useMemo(
    () => rows.filter((r) => r.status === 'accepted'),
    [rows]
  );
  const incomingRequests = useMemo(
    () => rows.filter((r) => r.status === 'pending_incoming'),
    [rows]
  );
  const outgoingRequests = useMemo(
    () => rows.filter((r) => r.status === 'pending_outgoing'),
    [rows]
  );
  const blockedUsers = useMemo(
    () => rows.filter((r) => r.status === 'blocked'),
    [rows]
  );

  const findFriendship = useCallback(
    (friendUserId: string) => rows.find((r) => r.friendId === friendUserId),
    [rows]
  );

  const sendRequest = useCallback(
    async (
      myProfile: Omit<MyProfileInput, 'userId'>,
      friend: ProfileCard
    ) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[useFriends] Cannot send request: User not authenticated'
        );
        return;
      }
      await sendFriendRequest({
        myUserId: uid,
        myUsername: myProfile.username,
        myDisplayName: myProfile.displayName,
        myAvatarFileId: myProfile.avatarFileId || '',
        friend,
      });
    },
    [user?.$id]
  );

  const accept = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useFriends] Cannot accept: User not authenticated');
        return;
      }
      await acceptFriendRequest(uid, friendUserId);
    },
    [user?.$id]
  );

  const decline = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useFriends] Cannot decline: User not authenticated');
        return;
      }
      await deleteFriendPair(uid, friendUserId);
      await clearCachedCalendar(friendUserId);
    },
    [user?.$id]
  );

  const cancel = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useFriends] Cannot cancel: User not authenticated');
        return;
      }
      await deleteFriendPair(uid, friendUserId);
      await clearCachedCalendar(friendUserId);
    },
    [user?.$id]
  );

  const remove = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useFriends] Cannot remove: User not authenticated');
        return;
      }
      await deleteFriendPair(uid, friendUserId);
      await clearCachedCalendar(friendUserId);
    },
    [user?.$id]
  );

  const block = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useFriends] Cannot block: User not authenticated');
        return;
      }
      await blockFriend(uid, friendUserId);
      await clearCachedCalendar(friendUserId);
    },
    [user?.$id]
  );

  const isLoading = !!userId && loadedUserId !== userId;

  return {
    friends: userId && loadedUserId === userId ? friends : [],
    incomingRequests:
      userId && loadedUserId === userId ? incomingRequests : [],
    outgoingRequests:
      userId && loadedUserId === userId ? outgoingRequests : [],
    blockedUsers: userId && loadedUserId === userId ? blockedUsers : [],
    isLoading,
    sendRequest,
    accept,
    decline,
    cancel,
    remove,
    block,
    findFriendship,
  };
}