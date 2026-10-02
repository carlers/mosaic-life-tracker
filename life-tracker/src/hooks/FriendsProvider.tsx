import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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
import { scopeFriendshipCommands, subscribeFriendshipCommands, getFriendshipRevision, pendingFriendshipRows } from '../lib/friendshipCommands';
import {
  FriendsContext,
  type MyProfileSummary,
  type UseFriendsReturn,
} from './friendsContext';
import type { FriendshipDocument } from '../db/schema';
import type { ProfileCard } from '../lib/social';
import { markStartup } from '../lib/startupMetrics';
interface FriendsProviderProps {
  children: ReactNode;
}
export const FriendsProvider: React.FC<FriendsProviderProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const userId = user?.$id;
  const [confirmedRows, setRows] = useState<FriendshipDocument[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  useEffect(() => {
    scopeFriendshipCommands(userId ?? null);
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
          markStartup('home:friends-ready');
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
      scopeFriendshipCommands(null);
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);
  const queueRevision = useSyncExternalStore(subscribeFriendshipCommands, getFriendshipRevision);
  const rows = useMemo(() => {
    const visible = userId && loadedUserId === userId ? confirmedRows : [];
    if (!userId) return [];
    // External-store revision invalidates the persisted queue projection.
    void queueRevision;
    const pending = pendingFriendshipRows(userId);
    return [...visible, ...pending.filter(p => !visible.some(r => r.friendId === p.friendId))];
  }, [confirmedRows, userId, loadedUserId, queueRevision]);
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
        throw new Error('Not authenticated');
      }
      return sendFriendRequest({
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
        throw new Error('Not authenticated');
      }
      return acceptFriendRequest(uid, friendUserId);
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
        throw new Error('Not authenticated');
      }
      const result = await deleteFriendPair(uid, friendUserId, 'decline');
      return result;
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
        throw new Error('Not authenticated');
      }
      const result = await deleteFriendPair(uid, friendUserId, 'cancel');
      return result;
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
        throw new Error('Not authenticated');
      }
      const result = await deleteFriendPair(uid, friendUserId);
      return result;
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
        throw new Error('Not authenticated');
      }
      const result = await blockFriend(uid, friendUserId);
      return result;
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
