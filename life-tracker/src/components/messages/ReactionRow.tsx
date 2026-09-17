import React from 'react';
import { motion } from 'framer-motion';
import type { Reaction } from '../../lib/reactionUtils';

const MAX_VISIBLE = 6;

interface ReactionRowProps {
  reactions: Reaction[];
  currentUserId: string;
  isOutgoing: boolean;
  onToggle: (emoji: string) => void;
}

export const ReactionRow: React.FC<ReactionRowProps> = ({
  reactions,
  currentUserId,
  isOutgoing,
  onToggle,
}) => {
  if (reactions.length === 0) return null;

  const visible = reactions.slice(0, MAX_VISIBLE);
  const overflow = reactions.length - visible.length;

  return (
    <div className={`flex flex-wrap gap-1 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {visible.map((reaction) => {
        const hasReacted = reaction.userIds.includes(currentUserId);
        return (
          <motion.button
            key={reaction.emoji}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(reaction.emoji);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
              hasReacted
                ? 'bg-[#2563EB]/30 border border-[#2563EB]'
                : 'bg-[#2A2A2A] border border-transparent'
            }`}
            aria-label={`React with ${reaction.emoji}`}
          >
            <span>{reaction.emoji}</span>
            <span className="text-gray-300">{reaction.userIds.length}</span>
          </motion.button>
        );
      })}
      {overflow > 0 && (
        <span className="flex items-center px-2 py-0.5 rounded-full text-xs bg-[#2A2A2A] text-gray-300">
          +{overflow}
        </span>
      )}
    </div>
  );
};
