import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { isFeatureEnabled } from '../lib/featureControls';
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
      if (!isFeatureEnabled('mosaic_disable_all_social')) throw new Error('Social features are paused');
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
