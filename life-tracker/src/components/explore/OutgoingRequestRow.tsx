import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import type { FriendshipDocument } from '../../db/schema';

interface OutgoingRequestRowProps {
  friendship: FriendshipDocument;
  onCancel: (friendId: string) => Promise<void>;
}

export const OutgoingRequestRow: React.FC<OutgoingRequestRowProps> = ({
  friendship,
  onCancel,
}) => {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await onCancel(friendship.friendId);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3">
      <DeferredAvatar
        fileId={friendship.friendAvatarFileId || undefined}
        alt={friendship.friendDisplayName || friendship.friendUsername}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {friendship.friendDisplayName || friendship.friendUsername}
        </p>
        <p className="text-xs text-gray-400 truncate">
          @{friendship.friendUsername}
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleCancel}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={isCancelling}
        aria-label="Cancel friend request"
        className="flex items-center gap-1.5 bg-[#2A2A2A] hover:bg-[#333333] text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
      >
        {isCancelling ? (
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <X size={12} strokeWidth={3} />
            Cancel
          </>
        )}
      </motion.button>
    </div>
  );
};
