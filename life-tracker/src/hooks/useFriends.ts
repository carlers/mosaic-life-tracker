import { useContext } from 'react';
import { FriendsContext } from './friendsContext';
import type { UseFriendsReturn } from './friendsContext';
export type { UseFriendsReturn, MyProfileSummary } from './friendsContext';
// Read-only friend labels may be displayed in retained preview/test shells before
// FriendsProvider is mounted. Mutating friendship actions still require useFriends.
export function useOptionalFriendList(): UseFriendsReturn['friends'] {
  return useContext(FriendsContext)?.friends ?? [];
}
export function useFriends(): UseFriendsReturn {
  const ctx = useContext(FriendsContext);
  if (!ctx) {
    throw new Error(
      'useFriends must be used within a <FriendsProvider>. ' +
        'Check that <FriendsProvider> wraps the consuming tree.'
    );
  }
  return ctx;
}
