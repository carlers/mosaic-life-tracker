import type { FriendshipResult } from '../lib/friendshipCommands';
import { createContext } from 'react';
import type { FriendshipDocument } from '../db/schema';
import type { ProfileCard } from '../lib/social';
export interface MyProfileSummary {
  username: string;
  displayName: string;
  avatarFileId?: string;
  bio?: string;
}
export interface UseFriendsReturn {
  friends: FriendshipDocument[];
  incomingRequests: FriendshipDocument[];
  outgoingRequests: FriendshipDocument[];
  blockedUsers: FriendshipDocument[];
  isLoading: boolean;
  sendRequest: (
    myProfile: MyProfileSummary,
    friend: ProfileCard
  ) => Promise<FriendshipResult>;
  accept: (friendUserId: string) => Promise<FriendshipResult>;
  decline: (friendUserId: string) => Promise<FriendshipResult>;
  cancel: (friendUserId: string) => Promise<FriendshipResult>;
  remove: (friendUserId: string) => Promise<FriendshipResult>;
  block: (friendUserId: string) => Promise<FriendshipResult>;
  findFriendship: (friendUserId: string) => FriendshipDocument | undefined;
}
export const FriendsContext = createContext<UseFriendsReturn | null>(null);
