import { useContext } from 'react';
import { ConversationsContext } from './conversationsContext';
export interface UseUnreadMessagesReturn {
  totalUnread: number;
  isLoading: boolean;
}
export function useUnreadMessages(): UseUnreadMessagesReturn {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error(
      'useUnreadMessages must be used within a <ConversationsProvider>. ' +
        'Check that <ConversationsProvider> wraps the consuming tree.'
    );
  }
  return { totalUnread: ctx.totalUnread, isLoading: ctx.isLoading };
}
