import { useContext } from 'react';
import { UnreadMessagesContext } from './unreadMessagesContext';

export interface UseUnreadMessagesReturn {
  totalUnread: number;
  isLoading: boolean;
}

export function useUnreadMessages(): UseUnreadMessagesReturn {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) {
    throw new Error(
      'useUnreadMessages must be used within a <ConversationsProvider>. ' +
        'Check that <ConversationsProvider> wraps the consuming tree.'
    );
  }
  return ctx;
}
