import { useThreadMessages } from './useThreadMessages';
import { useMessageActions } from './useMessageActions';
import type { MessageDocument, TaskDocument } from '../db/schema';

export type { ReplyContext } from './useMessageActions';

export interface UseMessagesReturn {
  messages: MessageDocument[];
  isLoading: boolean;
  sendMessage: (content: string, replyTo?: import('./useMessageActions').ReplyContext) => Promise<void>;
  sendTaskReply: (
    task: TaskDocument,
    content: string,
    categoryColor: string
  ) => Promise<void>;
  sendTaskReaction: (
    task: TaskDocument,
    emoji: string,
    categoryColor: string
  ) => Promise<void>;
  markAllRead: () => Promise<void>;
  unsendMessage: (id: string) => Promise<void>;
  toggleReaction: (id: string, emoji: string) => Promise<'ok' | 'timeout'>;
}

/**
 * Composed messaging hook (HB-9). Facade over `useThreadMessages`
 * (read) + `useMessageActions` (write). The public shape is byte-
 * identical to the pre-extraction hook, so every call site is
 * unchanged. Consumers that only need one half (e.g. `PersonPane`
 * only calls `sendTaskReaction`) can be migrated to the narrower hooks
 * in a later batch — that is CB-1's structural fix, which lands in
 * 2.9, not here.
 */
export function useMessages(friendId: string | null): UseMessagesReturn {
  const { messages, isLoading } = useThreadMessages(friendId);
  const actions = useMessageActions(friendId);

  return {
    messages,
    isLoading,
    sendMessage: actions.sendMessage,
    sendTaskReply: actions.sendTaskReply,
    sendTaskReaction: actions.sendTaskReaction,
    markAllRead: actions.markAllRead,
    unsendMessage: actions.unsendMessage,
    toggleReaction: actions.toggleReaction,
  };
}
