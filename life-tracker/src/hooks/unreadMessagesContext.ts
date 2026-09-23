import { createContext } from 'react';

export interface UnreadMessagesContextValue {
  totalUnread: number;
  isLoading: boolean;
}

export const UnreadMessagesContext =
  createContext<UnreadMessagesContextValue | null>(null);
