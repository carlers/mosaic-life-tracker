import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { FriendCalendarView } from '../components/friend/FriendCalendarView';
import { useFriendCalendar } from '../lib/useFriendCalendar';
import { useFriends } from '../hooks/useFriends';
import { useTaskImage } from '../hooks/useTaskImage';
import { clearCachedCalendar } from '../lib/friendCache';

export const FriendCalendarPage: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { friends, isLoading: friendsLoading } = useFriends();

  // Derived directly from the friends list — no state, no effect.
  const friend = useMemo(() => {
    if (!friendId || friendsLoading) return null;
    return friends.find((f) => f.friendId === friendId) || null;
  }, [friendId, friends, friendsLoading]);

  const {
    tasks,
    categories,
    isLoading,
    error,
    errorKind,
    refetch,
    lastFetchedAt,
  } = useFriendCalendar(friend ? friend.friendId : null);

  const { imageUrl } = useTaskImage(friend?.friendAvatarFileId || undefined);

  const handleBack = () => navigate(-1);

  const handleRefresh = async () => {
    if (friend) {
      await clearCachedCalendar(friend.friendId);
    }
    await refetch(true);
  };

  const handleGoToExplore = () => {
    navigate('/explore', { replace: true });
  };

  if (friendsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!friend) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333] flex items-center">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-white font-medium mb-2">Not friends anymore</p>
            <p className="text-sm text-gray-500 mb-6">
              You can no longer view this calendar.
            </p>
            <button
              onClick={handleGoToExplore}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Back to Explore
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = friend.friendDisplayName || friend.friendUsername;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>

          <Avatar
            src={imageUrl || undefined}
            alt={displayName}
            size="sm"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              @{friend.friendUsername}
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </motion.button>
        </div>

        {lastFetchedAt && !error && (
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            Last updated {new Date(lastFetchedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]">
              <span className="text-2xl">🔒</span>
            </div>
            <p className="text-white font-medium mb-2">
              {errorKind === 'forbidden'
                ? 'No access'
                : errorKind === 'offline'
                ? "You're offline"
                : "Couldn't load calendar"}
            </p>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">{error}</p>
            {errorKind !== 'forbidden' && (
              <button
                onClick={() => refetch(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]">
              <span className="text-2xl">📭</span>
            </div>
            <p className="text-white font-medium mb-2">Nothing shared yet</p>
            <p className="text-sm text-gray-500 max-w-xs">
              {displayName} hasn't shared any tasks with you.
            </p>
          </div>
        ) : (
          <FriendCalendarView
            friendName={displayName}
            tasks={tasks}
            categories={categories}
          />
        )}
      </div>
    </div>
  );
};