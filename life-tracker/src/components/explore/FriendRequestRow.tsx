import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useTaskImage } from '../../hooks/useTaskImage';
import type { FriendshipDocument } from '../../db/schema';

interface FriendRequestRowProps {
  friendship: FriendshipDocument;
  onAccept: (friendId: string) => Promise<void>;
  onDecline: (friendId: string) => Promise<void>;
}

export const FriendRequestRow: React.FC<FriendRequestRowProps> = ({
  friendship,
  onAccept,
  onDecline,
}) => {
  const { imageUrl } = useTaskImage(friendship.friendAvatarFileId || undefined);
  const [pendingAction, setPendingAction] = useState<'accept' | 'decline' | null>(
    null
  );

  const handleAccept = async () => {
    setPendingAction('accept');
    try {
      await onAccept(friendship.friendId);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDecline = async () => {
    setPendingAction('decline');
    try {
      await onDecline(friendship.friendId);
    } finally {
      setPendingAction(null);
    }
  };

  const busy = pendingAction !== null;

  return (
    <div className="flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3">
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
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleAccept}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={busy}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
          aria-label="Accept"
        >
          {pendingAction === 'accept' ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check size={16} strokeWidth={3} />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleDecline}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={busy}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2A2A2A] hover:bg-[#333333] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          aria-label="Decline"
        >
          {pendingAction === 'decline' ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <X size={16} strokeWidth={3} />
          )}
        </motion.button>
      </div>
    </div>
  );
};