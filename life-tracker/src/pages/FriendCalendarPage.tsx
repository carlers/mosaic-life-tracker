import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { FriendCalendarView } from '../components/friend/FriendCalendarView';
import { useFriendCalendar } from '../lib/useFriendCalendar';
import { useFriends } from '../hooks/useFriends';
import { useMessageActions } from '../hooks/useMessageActions';
import { useAuth } from '../hooks/useAuth';
import { clearCachedCalendar } from '../lib/friendCache';
import type { TaskDocument } from '../db/schema';

export const FriendCalendarPage: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
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
    navigate('/messages');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (friendId) {
      await clearCachedCalendar(friendId);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
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
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A]">
        <button
          onClick={handleBack}
          className="p-1 text-gray-400"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <Avatar
          src={friend?.friendAvatarFileId}
          alt={friend?.friendDisplayName}
          size="sm"
        />
        <span className="font-medium">
          {friend?.friendDisplayName || friend?.friendUsername || 'Friend'}
        </span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          className="ml-auto p-2 text-gray-400"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
        </motion.button>
      </div>
      <FriendCalendarView
        friendName={friend?.friendDisplayName || friend?.friendUsername || 'Friend'}
        friendUserId={friendId ?? ''}
        currentUserId={currentUserId}
        tasks={tasks}
        categories={categories}
        onReactToTask={handleReactToTask}
      />
    </div>
  );
};
