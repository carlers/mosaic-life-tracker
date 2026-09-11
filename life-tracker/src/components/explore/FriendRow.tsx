import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useTaskImage } from '../../hooks/useTaskImage';
import type { FriendshipDocument } from '../../db/schema';

interface FriendRowProps {
  friendship: FriendshipDocument;
  onOpenActions: (friendship: FriendshipDocument) => void;
}

export const FriendRow: React.FC<FriendRowProps> = ({
  friendship,
  onOpenActions,
}) => {
  const { imageUrl } = useTaskImage(friendship.friendAvatarFileId || undefined);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3"
    >
      <Avatar
        src={imageUrl || undefined}
        alt={friendship.friendDisplayName || friendship.friendUsername}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {friendship.friendDisplayName || friendship.friendUsername}
        </p>
        <p className="text-xs text-gray-500 truncate">
          @{friendship.friendUsername}
        </p>
      </div>
      <button
        onClick={() => onOpenActions(friendship)}
        onPointerDown={(e) => e.stopPropagation()}
        className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
        aria-label="Friend options"
      >
        <MoreHorizontal size={18} />
      </button>
    </motion.div>
  );
};