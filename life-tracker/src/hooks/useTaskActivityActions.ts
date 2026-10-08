import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { sendTaskReactionMessage } from '../lib/messageComposer';
import type { TaskDocument } from '../db/schema';

export function useTaskActivityActions() {
  const { user } = useAuth();

  const sendTaskReaction = useCallback(
    async (
      friendId: string,
      task: TaskDocument,
      emoji: string,
      categoryColor: string
    ) => {
      const userId = user?.$id;
      if (!userId || !friendId) return;
      await sendTaskReactionMessage(
        userId,
        friendId,
        task,
        emoji,
        categoryColor
      );
    },
    [user?.$id]
  );

  return { sendTaskReaction };
}
