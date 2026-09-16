import { createContext } from 'react';
import type { MessageDocument, FriendshipDocument } from '../db/schema';
export interface Conversation {
  threadId: string;
  friend: FriendshipDocument;
  lastMessage: MessageDocument | null;
  unreadCount: number;
}
export interface ConversationsContextValue {
  conversations: Conversation[];
  totalUnread: number;
  isLoading: boolean;
}
export const ConversationsContext =
  createContext<ConversationsContextValue | null>(null);
