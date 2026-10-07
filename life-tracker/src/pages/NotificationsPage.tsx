import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  Heart,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DeferredAvatar } from '../components/ui/DeferredAvatar';
import { EmojiPickerSheet } from '../components/messages/EmojiPickerSheet';
import { ReactionRow } from '../components/messages/ReactionRow';
import { ReplyComposerSheet } from '../components/messages/ReplyComposerSheet';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useConnectivity } from '../hooks/useConnectivity';
import { useTaskActivityActions } from '../hooks/useTaskActivityActions';
import {
  fetchNotifications,
  markNotificationsRead,
  type NotificationItem,
} from '../lib/notifications';
import {
  getCachedNotifications,
  patchCachedNotificationTask,
  setCachedNotifications,
} from '../lib/notificationCache';
import { reactToTaskOnRemote } from '../lib/messageDelivery';
import {
  applyReactionDelta,
  hasUserReacted,
  parseReactions,
  stringifyReactions,
} from '../lib/reactionUtils';
import { getReadableTextColor } from '../constants/colors';

interface ActivityGroup {
  key: string;
  actorId: string;
  actorName: string;
  actorAvatarFileId: string;
  occurredAt: string;
  items: NotificationItem[];
}

function groupActivity(items: NotificationItem[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const item of items) {
    const key = `${item.actorId}::${item.task.date}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      if (item.occurredAt > existing.occurredAt) {
        existing.occurredAt = item.occurredAt;
      }
      continue;
    }
    groups.set(key, {
      key,
      actorId: item.actorId,
      actorName: item.actorName,
      actorAvatarFileId: item.actorAvatarFileId,
      occurredAt: item.occurredAt,
      items: [item],
    });
  }
  return [...groups.values()].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt)
  );
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.$id ?? '';
  const connectivity = useConnectivity();
  const { sendTaskReaction } = useTaskActivityActions();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [fetchedAt, setFetchedAt] = useState('');
  const [isHydrating, setIsHydrating] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reactionTarget, setReactionTarget] =
    useState<NotificationItem | null>(null);
  const [replyTarget, setReplyTarget] =
    useState<NotificationItem | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setIsHydrating(true);
    void getCachedNotifications(userId).then((cached) => {
      if (!active) return;
      if (cached) {
        setItems(cached.items);
        setNextCursor(cached.nextCursor);
        setFetchedAt(cached.fetchedAt);
      }
      setIsHydrating(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId || connectivity.status !== 'online') return;
    setIsRefreshing(true);
    setError('');
    try {
      const page = await fetchNotifications('', 30);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setFetchedAt(page.fetchedAt);
      await setCachedNotifications(userId, page);

      const unreadIds = page.items
        .filter((item) => !item.readAt)
        .map((item) => item.id);
      if (unreadIds.length > 0) {
        try {
          await markNotificationsRead(unreadIds);
          const readAt = new Date().toISOString();
          const readSet = new Set(unreadIds);
          setItems((current) =>
            current.map((item) =>
              readSet.has(item.id) ? { ...item, readAt } : item
            )
          );
        } catch (readError) {
          console.warn('[NotificationsPage] mark read failed:', readError);
        }
      }
    } catch (cause) {
      console.error('[NotificationsPage] refresh failed:', cause);
      setError(
        items.length > 0
          ? 'Could not refresh activity.'
          : 'Could not load activity.'
      );
    } finally {
      setIsRefreshing(false);
      setIsHydrating(false);
    }
  }, [connectivity.status, items.length, userId]);

  useEffect(() => {
    if (connectivity.status === 'online') {
      void refresh();
    }
  }, [connectivity.status, refresh]);

  const loadMore = async () => {
    if (
      !userId ||
      !nextCursor ||
      isLoadingMore ||
      connectivity.status !== 'online'
    ) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const page = await fetchNotifications(nextCursor, 30);
      const merged = [
        ...items,
        ...page.items.filter(
          (candidate) => !items.some((item) => item.id === candidate.id)
        ),
      ];
      setItems(merged);
      setNextCursor(page.nextCursor);
      setFetchedAt(page.fetchedAt);
      await setCachedNotifications(userId, {
        items: merged,
        nextCursor: page.nextCursor,
        fetchedAt: page.fetchedAt,
      });

      const unreadIds = page.items
        .filter((item) => !item.readAt)
        .map((item) => item.id);
      if (unreadIds.length > 0) {
        void markNotificationsRead(unreadIds).catch((readError) => {
          console.warn('[NotificationsPage] mark read failed:', readError);
        });
      }
    } catch (cause) {
      console.error('[NotificationsPage] load more failed:', cause);
      setError('Could not load more activity.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const patchTask = useCallback(
    (taskId: string, reactions: string) => {
      setItems((current) =>
        current.map((item) =>
          item.task.id === taskId
            ? { ...item, task: { ...item.task, reactions } }
            : item
        )
      );
      if (userId) {
        void patchCachedNotificationTask(userId, taskId, { reactions });
      }
    },
    [userId]
  );

  const handleReaction = useCallback(
    async (item: NotificationItem, emoji: string) => {
      if (!userId || connectivity.status !== 'online') return;
      const current = parseReactions(item.task.reactions);
      const op = hasUserReacted(current, emoji, userId)
        ? 'remove'
        : 'add';
      const optimistic = stringifyReactions(
        applyReactionDelta(current, emoji, userId, op)
      );
      const original = item.task.reactions ?? '';
      patchTask(item.task.id, optimistic);

      try {
        const serverReactions = await reactToTaskOnRemote(
          item.task.id,
          item.actorId,
          emoji,
          op
        );
        const confirmed = serverReactions || optimistic;
        patchTask(item.task.id, confirmed);
        if (op === 'add') {
          await sendTaskReaction(
            item.actorId,
            { ...item.task, reactions: confirmed },
            emoji,
            item.categoryColor
          );
        }
      } catch (cause) {
        patchTask(item.task.id, original);
        console.error('[NotificationsPage] task reaction failed:', cause);
      }
    },
    [
      connectivity.status,
      patchTask,
      sendTaskReaction,
      userId,
    ]
  );

  const groups = useMemo(() => groupActivity(items), [items]);
  const canInteract = connectivity.status === 'online';

  return (
    <div className="min-h-full bg-[#111111] text-white">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#2A2A2A] bg-[#111111] px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">Alerts</h1>
          {fetchedAt && (
            <p className="text-[11px] text-gray-400">
              {connectivity.status === 'online'
                ? 'Recent friend activity'
                : 'Showing saved activity'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing || connectivity.status !== 'online'}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#252525] hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Refresh alerts"
        >
          <RefreshCw
            size={18}
            className={isRefreshing ? 'animate-spin' : ''}
            aria-hidden="true"
          />
        </button>
      </header>

      {isHydrating && items.length === 0 ? (
        <div className="flex min-h-[55vh] items-center justify-center" role="status">
          <Spinner size="w-7 h-7" />
          <span className="sr-only">Loading alerts</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1E1E1E]">
            <Bell size={24} className="text-gray-400" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold">No activity yet</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-400">
            Shared task completions from friends will appear here.
          </p>
          {error && (
            <p className="mt-4 text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 pb-28 pt-3">
          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.key} aria-label={`${group.actorName} activity`}>
                <div className="mb-2 flex items-center gap-3">
                  <DeferredAvatar
                    fileId={group.actorAvatarFileId || undefined}
                    alt={group.actorName}
                    size="sm"
                  />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">{group.actorName}</span>{' '}
                    <span className="text-gray-300">
                      completed {group.items.length}{' '}
                      {group.items.length === 1 ? 'item' : 'items'}.
                    </span>{' '}
                    <span className="text-gray-500">
                      {formatDistanceToNow(new Date(group.occurredAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </p>
                </div>

                <div className="ml-5 border-l-2 border-[#3A3A3A] pl-4">
                  <div className="divide-y divide-[#2A2A2A]">
                    {group.items.map((item) => {
                      const reactions = parseReactions(item.task.reactions);
                      return (
                        <div key={item.id} className="py-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: item.categoryColor,
                                color: getReadableTextColor(
                                  item.categoryColor
                                ),
                              }}
                              aria-hidden="true"
                            >
                              <Check size={10} strokeWidth={3.5} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-[0.95rem] leading-snug text-gray-100">
                                {item.task.title}
                              </p>
                              {reactions.length > 0 && (
                                <div className="mt-2">
                                  <ReactionRow
                                    reactions={reactions}
                                    currentUserId={userId}
                                    isOutgoing={false}
                                    onToggle={(emoji) =>
                                      void handleReaction(item, emoji)
                                    }
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.9 }}
                                disabled={!canInteract}
                                onClick={() => setReplyTarget(item)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#252525] hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                                aria-label={`Reply to ${item.task.title}`}
                              >
                                <MessageSquare size={16} />
                              </motion.button>
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.9 }}
                                disabled={!canInteract}
                                onClick={() => setReactionTarget(item)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#252525] hover:text-pink-400 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                                aria-label={`React to ${item.task.title}`}
                              >
                                <Heart size={17} />
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>

          {nextCursor && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={
                isLoadingMore || connectivity.status !== 'online'
              }
              className="mt-6 w-full rounded-xl bg-[#1E1E1E] px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-[#252525] disabled:opacity-40"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}

      <EmojiPickerSheet
        isOpen={Boolean(reactionTarget)}
        onClose={() => setReactionTarget(null)}
        onPick={(emoji) => {
          if (reactionTarget) {
            void handleReaction(reactionTarget, emoji);
          }
        }}
      />

      <ReplyComposerSheet
        isOpen={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        task={replyTarget?.task ?? null}
        categoryColor={replyTarget?.categoryColor ?? ''}
        friendId={replyTarget?.actorId ?? null}
        friendName={replyTarget?.actorName ?? 'Friend'}
      />
    </div>
  );
};
