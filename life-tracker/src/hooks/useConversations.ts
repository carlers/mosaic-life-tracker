import { useContext } from 'react';
import { ConversationsContext } from './conversationsContext';
import type { Conversation } from './conversationsContext';
export type { Conversation } from './conversationsContext';
export interface UseConversationsReturn {
  conversations: Conversation[];
  totalUnread: number;
  isLoading: boolean;
}
export function useConversations(): UseConversationsReturn {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error(
      'useConversations must be used within a <ConversationsProvider>. ' +
        'Check that <ConversationsProvider> wraps the consuming tree.'
    );
  }
  return ctx;
}
