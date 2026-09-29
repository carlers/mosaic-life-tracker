import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { UserMinus, ShieldOff } from 'lucide-react';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import type { FriendshipDocument } from '../../db/schema';

interface FriendActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  friendship: FriendshipDocument | null;
  onRemove: (friendId: string) => Promise<unknown>;
  onBlock: (friendId: string) => Promise<unknown>;
}

export const FriendActionSheet: React.FC<FriendActionSheetProps> = ({
  isOpen,
  onClose,
  friendship,
  onRemove,
  onBlock,
}) => {
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  if (!friendship) return null;

  const handleAction = async (fn: (id: string) => Promise<unknown>) => {
    setIsWorking(true);
    setError('');
    try {
      await fn(friendship.friendId);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update friendship.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={friendship.friendDisplayName || friendship.friendUsername}
      height="auto"
    >
      <div className="pt-2 pb-8 px-4">
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-col items-center mb-6">
          <DeferredAvatar
            fileId={friendship.friendAvatarFileId || undefined}
            eager
            alt={friendship.friendDisplayName || friendship.friendUsername}
            size="lg"
          />
          <p className="text-xs text-gray-400 mt-3">
            @{friendship.friendUsername}
          </p>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => handleAction(onRemove)}
            disabled={isWorking}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center">
              <UserMinus size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Remove Friend</span>
          </button>
          <button
            onClick={() => handleAction(onBlock)}
            disabled={isWorking}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-red-400 disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-full bg-red-400 flex items-center justify-center">
              <ShieldOff size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Block</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
