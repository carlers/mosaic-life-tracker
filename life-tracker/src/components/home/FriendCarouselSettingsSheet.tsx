import React, { useEffect, useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, RotateCcw } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import type { FriendshipDocument } from '../../db/schema';

interface FriendRowProps {
  friend: FriendshipDocument;
  hidden: boolean;
  onToggle: () => void;
}

const FriendRow: React.FC<FriendRowProps> = ({ friend, hidden, onToggle }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={friend.friendId}
      dragListener={false}
      dragControls={dragControls}
      className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 flex items-center gap-3"
    >
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          dragControls.start(e);
        }}
        className="p-1 -ml-1 text-gray-400 hover:text-white touch-none cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <DeferredAvatar
        fileId={friend.friendAvatarFileId || undefined}
        alt={friend.friendDisplayName || friend.friendUsername}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {friend.friendDisplayName || friend.friendUsername}
        </p>
        <p className="text-xs text-gray-400 truncate">
          @{friend.friendUsername}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        onPointerDown={(e) => e.stopPropagation()}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
          hidden ? 'bg-gray-600' : 'bg-emerald-500'
        }`}
        aria-label={hidden ? 'Show in carousel' : 'Hide from carousel'}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            hidden ? 'left-0.5' : 'left-[22px]'
          }`}
        />
      </button>
    </Reorder.Item>
  );
};

interface FriendCarouselSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  friends: FriendshipDocument[];
  order: string[];
  hidden: string[];
  onReorder: (newOrder: string[]) => void;
  onToggleVisibility: (friendId: string) => void;
  onReset: () => void;
}

export const FriendCarouselSettingsSheet: React.FC<
  FriendCarouselSettingsSheetProps
> = ({
  isOpen,
  onClose,
  friends,
  order,
  hidden,
  onReorder,
  onToggleVisibility,
  onReset,
}) => {
  const sortedFriends = useMemo(() => {
    const orderIndex = new Map<string, number>();
    order.forEach((id, idx) => orderIndex.set(id, idx));
    return [...friends].sort((a, b) => {
      const aIdx = orderIndex.get(a.friendId);
      const bIdx = orderIndex.get(b.friendId);
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;
      const aName = (a.friendDisplayName || a.friendUsername || '').toLowerCase();
      const bName = (b.friendDisplayName || b.friendUsername || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [friends, order]);

  const [items, setItems] = useState<string[]>(() =>
    sortedFriends.map((f) => f.friendId)
  );

  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setItems(sortedFriends.map((f) => f.friendId));
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      onReorder(items);
    }, 400);
    return () => clearTimeout(t);
  }, [items, isOpen, onReorder]);

  const friendsById = useMemo(() => {
    const m = new Map<string, FriendshipDocument>();
    for (const f of friends) m.set(f.friendId, f);
    return m;
  }, [friends]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Friends in Carousel"
      height="auto"
    >
      <div className="pt-2 pb-8 px-1">
        <p className="text-xs text-gray-400 text-center mb-4 leading-relaxed px-3">
          Drag to reorder. Toggle to show or hide a friend from the top carousel.
        </p>
        {friends.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-gray-400">No friends yet.</p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={setItems}
            className="space-y-2"
          >
            {items.map((friendId) => {
              const friend = friendsById.get(friendId);
              if (!friend) return null;
              return (
                <FriendRow
                  key={friendId}
                  friend={friend}
                  hidden={hidden.includes(friendId)}
                  onToggle={() => onToggleVisibility(friendId)}
                />
              );
            })}
          </Reorder.Group>
        )}
        <div className="pt-4 px-3">
          <button
            type="button"
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1E1E1E] border border-[#333333] rounded-xl text-sm text-gray-300 hover:bg-[#252525] transition-colors"
          >
            <RotateCcw size={14} />
            Reset to alphabetical
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
