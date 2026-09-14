import { useConversations } from './useConversations';

export interface UseUnreadMessagesReturn {
  totalUnread: number;
  isLoading: boolean;
}

export function useUnreadMessages(): UseUnreadMessagesReturn {
  const { totalUnread, isLoading } = useConversations();
  return { totalUnread, isLoading };
}