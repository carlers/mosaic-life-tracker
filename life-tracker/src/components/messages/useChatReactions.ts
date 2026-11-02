import { useCallback } from 'react';
import { isFeatureEnabled } from '../../lib/featureControls';
import type { ToggleReactionResult } from '../../lib/messageReactions';

interface UseChatReactionsOptions {
  toggleReaction: (id: string, emoji: string) => Promise<ToggleReactionResult>;
  setFeedback: (msg: string) => void;
}

interface UseChatReactionsReturn {
  reactToMessage: (messageId: string, emoji: string) => void;
}

export function useChatReactions({
  toggleReaction,
  setFeedback,
}: UseChatReactionsOptions): UseChatReactionsReturn {
  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!isFeatureEnabled('mosaic_disable_chat_reactions')) return;
      toggleReaction(messageId, emoji)
        .then((r) => {
          if (r === 'timeout') {
            setFeedback("Couldn't send reaction. Try again.");
          }
        })
        .catch((err) => {
          console.error('[useChatReactions] react failed:', err);
        });
    },
    [toggleReaction, setFeedback]
  );

  return { reactToMessage };
}
