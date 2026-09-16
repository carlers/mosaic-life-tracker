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
  ) => Promise<void>;
  accept: (friendUserId: string) => Promise<void>;
  decline: (friendUserId: string) => Promise<void>;
  cancel: (friendUserId: string) => Promise<void>;
  remove: (friendUserId: string) => Promise<void>;
  block: (friendUserId: string) => Promise<void>;
  findFriendship: (friendUserId: string) => FriendshipDocument | undefined;
}
export const FriendsContext = createContext<UseFriendsReturn | null>(null);
