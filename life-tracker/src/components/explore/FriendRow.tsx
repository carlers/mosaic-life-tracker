import React from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import type { FriendshipDocument } from '../../db/schema';

interface FriendRowProps {
  friendship: FriendshipDocument;
  onOpenActions: (friendship: FriendshipDocument) => void;
}

export const FriendRow: React.FC<FriendRowProps> = ({
  friendship,
  onOpenActions,
}) => {
  const navigate = useNavigate();

  const handleOpen = () => {
    navigate(`/friends/${friendship.friendId}`);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handleOpen}
      className="flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 cursor-pointer hover:bg-[#252525] transition-colors"
    >
      <DeferredAvatar
        fileId={friendship.friendAvatarFileId || undefined}
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
      <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenActions(friendship);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors flex-shrink-0"
        aria-label="Friend options"
      >
        <MoreHorizontal size={18} />
      </button>
    </motion.div>
  );
};
