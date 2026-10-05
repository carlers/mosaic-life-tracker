import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { DeferredAvatar } from '../components/ui/DeferredAvatar';
import { FriendCalendarView } from '../components/friend/FriendCalendarView';
import { useFriendCalendar } from '../lib/useFriendCalendar';
import { useFriends } from '../hooks/useFriends';
import { useMessageActions } from '../hooks/useMessageActions';
import { useAuth } from '../hooks/useAuth';
import { clearCachedCalendar } from '../lib/friendCache';
import type { TaskDocument } from '../db/schema';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';

const FriendCalendarLoadingShell: React.FC = () => (
  <div className="flex-1 px-4 py-3" role="status">
    <div className="mb-4 h-8 rounded-lg bg-[#1A1A1A]" aria-hidden="true" />
    <div className="h-64 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
    <span className="sr-only">Loading friend calendar</span>
  </div>
);

export const FriendCalendarPage: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';

  const { friends } = useFriends();
  const friend = useMemo(
    () => friends.find((f) => f.friendId === friendId) ?? null,
    [friends, friendId]
  );

  const { sendTaskReaction } = useMessageActions(friendId ?? null);

  const {
    tasks,
    categories,
    isLoading,
    error,
    errorKind,
    refetch,
    reactToTask,
  } = useFriendCalendar(friendId ?? null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isRefreshing) return;
    const timer = setTimeout(() => setIsRefreshing(false), 1000);
    return () => clearTimeout(timer);
  }, [isRefreshing]);

  const handleBack = () => {
    const parent = '/explore';
    if (hasExpectedRouteParent(location.key, location.state, parent)) {
      navigate(-1);
    } else {
      navigate(parent, { replace: true });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (friendId && currentUserId) {
      await clearCachedCalendar(currentUserId, friendId);
    }
    await refetch(true);
  };

  const handleGoToExplore = () => {
    navigate('/explore');
  };

  const handleReactToTask = useCallback(
    async (task: TaskDocument, emoji: string) => {
      await reactToTask(task.id, emoji);
      if (task.userId !== currentUserId) {
        await sendTaskReaction(task, emoji, '');
      }
    },
    [reactToTask, sendTaskReaction, currentUserId]
  );


  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A]">
        <button
          onClick={handleBack}
          data-route-swipe-ignore="true"
          className="p-1 text-gray-400"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <DeferredAvatar
          fileId={friend?.friendAvatarFileId || undefined}
          eager
          alt={friend?.friendDisplayName}
          size="sm"
        />
        <span className="font-medium">
          {friend?.friendDisplayName || friend?.friendUsername || 'Friend'}
        </span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="ml-auto p-2 text-gray-400 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
        </motion.button>
      </div>
      {isLoading ? (
        <FriendCalendarLoadingShell />
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-gray-400">
          <p>
            {errorKind === 'forbidden'
              ? 'No access to this calendar'
              : 'Something went wrong'}
          </p>
          {errorKind === 'forbidden' && (
            <button
              onClick={handleGoToExplore}
              className="px-4 py-2 bg-[#2A2A2A] rounded-lg text-white"
            >
              Go to Explore
            </button>
          )}
        </div>
      ) : (
        <FriendCalendarView
          friendName={friend?.friendDisplayName || friend?.friendUsername || 'Friend'}
          friendUserId={friendId ?? ''}
          currentUserId={currentUserId}
          tasks={tasks}
          categories={categories}
          onReactToTask={handleReactToTask}
        />
      )}
    </div>
  );
};
