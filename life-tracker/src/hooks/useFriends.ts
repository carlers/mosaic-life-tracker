import { useContext } from 'react';
import { FriendsContext } from './friendsContext';
import type { UseFriendsReturn } from './friendsContext';
export type { UseFriendsReturn, MyProfileSummary } from './friendsContext';
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
