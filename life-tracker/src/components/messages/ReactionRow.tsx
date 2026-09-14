import React from 'react';
import { motion } from 'framer-motion';
import type { Reaction } from '../../lib/reactionUtils';

interface ReactionRowProps {
  reactions: Reaction[];
  currentUserId: string;
  isOutgoing: boolean;
  onToggle: (emoji: string) => void;
}

const MAX_VISIBLE = 6;

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
    <div
      className={`flex items-center flex-wrap gap-1 mt-1 max-w-[78%] ${
        isOutgoing ? 'justify-end' : 'justify-start'
      }`}
    >
      {visible.map((r) => {
        const mine = r.userIds.includes(currentUserId);
        return (
          <motion.button
            key={r.emoji}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(r.emoji);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] leading-none transition-colors ${
              mine
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-[#1E1E1E] border-[#333333] text-gray-300 hover:bg-[#252525]'
            }`}
          >
            <span className="text-[12px]">{r.emoji}</span>
            <span className="font-medium">{r.userIds.length}</span>
          </motion.button>
        );
      })}
      {overflow > 0 && (
        <span className="text-[10px] text-gray-500 px-1">+{overflow}</span>
      )}
    </div>
  );
};