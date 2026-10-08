import React, { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useFriendCalendar } from '../../lib/useFriendCalendar';
import { useTaskActivityActions } from '../../hooks/useTaskActivityActions';
import { useFriendTaskReply } from '../../hooks/useFriendTaskReply';
import { BottomSheet } from '../ui/BottomSheet';
import { FriendDayViewSheet } from './FriendDayViewSheet';
import { ReplyComposerSheet } from '../messages/ReplyComposerSheet';
import type { NotificationItem } from '../../lib/notifications';
import type { TaskDocument } from '../../db/schema';

export const AlertFriendDaySheet: React.FC<{
  notification: NotificationItem;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  const { user } = useAuth();
  const friendId = notification.actorId;
  const { tasks, categories, error, isLoading, lastFetchedAt, reactToTask } = useFriendCalendar(friendId, true);
  const { sendTaskReaction } = useTaskActivityActions();
  const [overriddenDate, setOverriddenDate] = useState<Date | null>(null);
  const [focusTaskId, setFocusTaskId] = useState(notification.task.id);
  const {
    replyTask, replyColor, handleReplyToTask, handleReplySent, closeReply,
  } = useFriendTaskReply(tasks);

  const verified = !!lastFetchedAt && !isLoading;

  const target = useMemo(
    () => tasks.find((task) => task.id === notification.task.id) ?? null,
    [tasks, notification.task.id]
  );

  const selectedDate = overriddenDate ??
    parseISO((target?.date || notification.task.date) + 'T12:00:00');

  const onReact = async (task: TaskDocument, emoji: string) => {
    try {
      const op = await reactToTask(task.id, emoji);
      if (op === 'add') {
        await sendTaskReaction(friendId, task, emoji,
          categories.find((category) => category.id === task.categoryId)?.color || '');
      }
    } catch (cause) {
      console.error('[AlertFriendDaySheet] reaction failed:', cause);
    }
  };

  if (!verified || error || !target) {
    return (
      <BottomSheet isOpen onClose={onClose} title={notification.actorName} height="auto">
        <div className="px-5 pb-8 pt-3 text-center text-sm text-gray-400" role="status">
          {!verified && !error
            ? 'Loading friend task…'
            : 'This task is no longer available to view.'}
          <button type="button" onClick={onClose}
            className="mt-5 block w-full rounded-lg bg-[#2A2A2A] px-3 py-2 text-white">
            Back to Alerts
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <>
      <FriendDayViewSheet
        isOpen
        onClose={onClose}
        date={selectedDate}
        onDateChange={(date) => { setFocusTaskId(''); setOverriddenDate(date); }}
        tasks={tasks}
        categories={categories}
        friendName={notification.actorName}
        currentUserId={user?.$id || ''}
        onReplyToTask={handleReplyToTask}
        onReactToTask={(task, emoji) => void onReact(task, emoji)}
        focusTaskId={focusTaskId}
      />
      <ReplyComposerSheet
        isOpen={!!replyTask}
        onClose={closeReply}
        task={replyTask}
        categoryColor={replyColor}
        friendId={friendId}
        friendName={notification.actorName}
        onSent={handleReplySent}
      />
    </>
  );
};
