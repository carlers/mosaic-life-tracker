import React, { useEffect, useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useFriendCalendar } from '../../lib/useFriendCalendar';
import { fetchFriendAlertTask, FriendAccessError } from '../../lib/friendData';
import { useTaskActivityActions } from '../../hooks/useTaskActivityActions';
import { useFriendTaskReply } from '../../hooks/useFriendTaskReply';
import { FriendDayViewSheet } from './FriendDayViewSheet';
import { ReplyComposerSheet } from '../messages/ReplyComposerSheet';
import { reactToTaskOnRemote } from '../../lib/messageDelivery';
import { hasUserReacted, parseReactions } from '../../lib/reactionUtils';
import type { NotificationItem } from '../../lib/notifications';
import type { TaskDocument, CategoryDocument } from '../../db/schema';

type FocusedTask = { task: TaskDocument; category: CategoryDocument | null };
type LookupState = 'checking' | 'ready' | 'fallback' | 'unavailable';

export const AlertFriendDaySheet: React.FC<{
  notification: NotificationItem;
  isOpen?: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
}> = ({ notification, isOpen = true, onClose, onExitComplete }) => {
  const { user } = useAuth();
  const userId = user?.$id ?? '';
  const friendId = notification.actorId;
  const taskId = notification.task.id;
  const completedAt = notification.task.completedAt || notification.occurredAt;

  // Validate the tapped task first: a large calendar fetch must never
  // delay the small trusted lookup. Start the full calendar in the background
  // only after the lookup returns. A legacy/offline fallback uses the cache.
  const [focused, setFocused] = useState<FocusedTask | null>(null);
  const [lookupState, setLookupState] = useState<LookupState>('checking');
  const calendarFriendId = lookupState === 'checking' || lookupState === 'unavailable'
    ? null : friendId;
  const calendar = useFriendCalendar(calendarFriendId, lookupState === 'ready');
  const { sendTaskReaction } = useTaskActivityActions();
  const [overriddenDate, setOverriddenDate] = useState<Date | null>(null);
  const [focusTaskId, setFocusTaskId] = useState(taskId);

  useEffect(() => {
    let active = true;
    void fetchFriendAlertTask(userId, friendId, taskId, completedAt)
      .then((result) => {
        if (!active) return;
        if (result) {
          setFocused(result);
          setLookupState('ready');
        } else {
          // A staggered frontend/Function rollout must remain usable.
          setLookupState('fallback');
        }
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof FriendAccessError && cause.kind === 'offline') {
          setLookupState('fallback');
        } else {
          console.warn('[AlertFriendDaySheet] task validation failed:', cause);
          setLookupState('unavailable');
        }
      });
    return () => { active = false; };
  }, [userId, friendId, taskId, completedAt]);

  const fallbackTask = calendar.lastFetchedAt
    ? calendar.tasks.find((task) => task.id === taskId &&
        task.completed && task.completedAt === completedAt) ?? null
    : null;
  // A fresh calendar can revoke a previously valid lookup while the sheet is
  // open; do not keep displaying a task that has since become unavailable.
  const revoked = lookupState === 'ready' &&
    (calendar.errorKind === 'forbidden' ||
      (!!calendar.lastFetchedAt && !calendar.isLoading && !fallbackTask));
  const target = revoked ? null : lookupState === 'ready' ? focused?.task ?? null
    : lookupState === 'fallback' ? fallbackTask
    : null;

  // Keep the live-verified task as the source of truth even when a 5-minute
  // cached calendar has older task details or omits a newly shared task.
  const sheetTasks = useMemo(() => {
    if (!target) return [];
    const list = calendar.lastFetchedAt ? calendar.tasks : [];
    return list.some((task) => task.id === target.id)
      ? list.map((task) => task.id === target.id ? target : task)
      : [...list, target];
  }, [calendar.lastFetchedAt, calendar.tasks, target]);

  const sheetCategories = useMemo(() => {
    if (!target || lookupState !== 'ready') return calendar.categories;
    // A private category name may be present in an older cached snapshot.
    // The focused response determines which metadata is safe to expose.
    const safe = calendar.categories.filter((category) => category.id !== target.categoryId);
    return focused?.category ? [...safe, focused.category] : safe;
  }, [calendar.categories, focused, target, lookupState]);

  const {
    replyTask, replyColor, handleReplyToTask, handleReplySent, closeReply,
  } = useFriendTaskReply(sheetTasks);

  const selectedDate = overriddenDate ??
    parseISO((target?.date || notification.task.date) + 'T12:00:00');

  const onReact = async (task: TaskDocument, emoji: string) => {
    if (!userId || !target || lookupState !== 'ready') return;
    const op = hasUserReacted(parseReactions(task.reactions), emoji, userId)
      ? 'remove' : 'add';
    try {
      const reactions = await reactToTaskOnRemote(task.id, friendId, emoji, op);
      setFocused((current) => current && current.task.id === task.id
        ? { ...current, task: { ...current.task, reactions } } : current);
      if (op === 'add') {
        await sendTaskReaction(friendId, { ...task, reactions }, emoji,
          sheetCategories.find((category) => category.id === task.categoryId)?.color || '');
      }
    } catch (cause) {
      console.error('[AlertFriendDaySheet] reaction failed:', cause);
    }
  };

  const unavailable = lookupState === 'unavailable' || revoked ||
    (lookupState === 'fallback' && !calendar.isLoading &&
      (!calendar.lastFetchedAt || !fallbackTask));
  const loading = !target && !unavailable;
  const statusMessage = unavailable
    ? 'This task is no longer available to view.'
    : loading ? 'Loading friend task…' : undefined;

  return (
    <>
      <FriendDayViewSheet
        isOpen={isOpen}
        onClose={onClose}
        onExitComplete={onExitComplete}
        date={selectedDate}
        onDateChange={(date) => { setFocusTaskId(''); setOverriddenDate(date); }}
        tasks={sheetTasks}
        categories={sheetCategories}
        friendName={notification.actorName}
        currentUserId={userId}
        onReplyToTask={target ? handleReplyToTask : undefined}
        onReactToTask={target && lookupState === 'ready'
          ? (task, emoji) => void onReact(task, emoji) : undefined}
        focusTaskId={focusTaskId}
        emptyMessage={statusMessage}
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
