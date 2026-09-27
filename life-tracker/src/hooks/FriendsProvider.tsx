import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import {
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendPair,
  blockFriend,
} from '../lib/social';
import { clearCachedCalendar } from '../lib/friendCache';
import { subscribeToSocialOutboxFailures } from '../lib/socialOutbox';
import {
  FriendsContext,
  type MyProfileSummary,
  type UseFriendsReturn,
} from './friendsContext';
import type { FriendshipDocument } from '../db/schema';
import type { ProfileCard } from '../lib/social';
interface FriendsProviderProps {
  children: ReactNode;
}
export const FriendsProvider: React.FC<FriendsProviderProps> = ({
  children,
}) => {
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
        const allMine = await db.friendships
          .find({ selector: { userId: uid } })
          .exec();
        for (const doc of allMine) {
          if (doc.id.length > 36 && doc.id.includes('_')) {
            if (import.meta.env.DEV) {
              console.log(
                '[FriendsProvider] Removing legacy friendship row:',
                doc.id
              );
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
        console.error('[FriendsProvider] Error loading friendships:', error);
        if (isMounted) setLoadedUserId(uid);
      }
    }
    init();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);
  // Revert-on-permanent-failure hook for the social outbox. When a queued
  // cross-user write is dropped (5 attempts exhausted, or a permanent
  // failure), the local RxDB row is un-patched so local and remote state
  // agree. The outbox entry carries enough revert info for each action.
  useEffect(() => {
    const unsubscribe = subscribeToSocialOutboxFailures((event) => {
      const { action, revert } = event;
      if (!revert.myRowId) return;
      void (async () => {
        try {
          const db = getDatabase();
          const doc = await db.friendships
            .findOne(revert.myRowId)
            .exec();
          if (!doc) return;
          const now = new Date().toISOString();
          if (action === 'send_request') {
            // The friend never learned about the request. Soft-delete our
            // optimistic row so the UI stops showing a phantom request.
            await doc.patch({ isDeleted: true, updatedAt: now });
          } else if (
            action === 'accept_friend_request' ||
            action === 'block_friend'
          ) {
            await doc.patch({
              status: revert.previousStatus ?? 'pending_incoming',
              updatedAt: now,
            });
          } else if (action === 'delete_friend_pair') {
            await doc.patch({ isDeleted: false, updatedAt: now });
          }
        } catch (err) {
          console.error('[FriendsProvider] Outbox revert failed:', err);
        }
      })();
    });
    return unsubscribe;
  }, []);
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
    async (myProfile: MyProfileSummary, friend: ProfileCard) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[FriendsProvider] Cannot send request: User not authenticated'
        );
        return;
      }
      await sendFriendRequest({
        myUserId: uid,
        myUsername: myProfile.username,
        myDisplayName: myProfile.displayName,
        myAvatarFileId: myProfile.avatarFileId || '',
        myBio: myProfile.bio || '',
        friend,
      });
    },
    [user?.$id]
  );
  const accept = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[FriendsProvider] Cannot accept: User not authenticated'
        );
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
        console.error(
          '[FriendsProvider] Cannot decline: User not authenticated'
        );
        return;
      }
      await deleteFriendPair(uid, friendUserId);
      await clearCachedCalendar(uid, friendUserId);
    },
    [user?.$id]
  );
  const cancel = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[FriendsProvider] Cannot cancel: User not authenticated'
        );
        return;
      }
      await deleteFriendPair(uid, friendUserId);
      await clearCachedCalendar(uid, friendUserId);
    },
    [user?.$id]
  );
  const remove = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[FriendsProvider] Cannot remove: User not authenticated'
        );
        return;
      }
      await deleteFriendPair(uid, friendUserId);
      await clearCachedCalendar(uid, friendUserId);
    },
    [user?.$id]
  );
  const block = useCallback(
    async (friendUserId: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[FriendsProvider] Cannot block: User not authenticated'
        );
        return;
      }
      await blockFriend(uid, friendUserId);
      await clearCachedCalendar(uid, friendUserId);
    },
    [user?.$id]
  );
  const isLoading = !!userId && loadedUserId !== userId;
  const value = useMemo<UseFriendsReturn>(
    () => ({
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
    }),
    [
      userId,
      loadedUserId,
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUsers,
      isLoading,
      sendRequest,
      accept,
      decline,
      cancel,
      remove,
      block,
      findFriendship,
    ]
  );
  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};
