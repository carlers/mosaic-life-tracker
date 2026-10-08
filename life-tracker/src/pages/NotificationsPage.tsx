import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { format, formatDistanceToNow } from 'date-fns';
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

interface NotificationsPageProps {
  preview?: boolean;
}

function completionDay(occurredAt: string): string {
  const parsed = new Date(occurredAt);
  return Number.isNaN(parsed.getTime())
    ? occurredAt.slice(0, 10)
    : format(parsed, 'yyyy-MM-dd');
}

function groupActivity(items: NotificationItem[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const item of items) {
    const key = `${item.actorId}::${completionDay(item.occurredAt)}`;
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

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  preview = false,
}) => {
  const { user } = useAuth();
  const userId = user?.$id ?? '';
  const connectivity = useConnectivity();
  const { sendTaskReaction } = useTaskActivityActions();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState('');
  const [fetchedAt, setFetchedAt] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reactionTarget, setReactionTarget] =
    useState<NotificationItem | null>(null);
  const [replyTarget, setReplyTarget] =
    useState<NotificationItem | null>(null);
  const remoteGenerationRef = useRef(0);

  useEffect(() => {
    const generation = ++remoteGenerationRef.current;
    let active = true;

    if (!userId) {
      queueMicrotask(() => {
        if (!active || generation !== remoteGenerationRef.current) return;
        setItems([]);
        setLoadedUserId(null);
        setNextCursor('');
        setFetchedAt('');
        setError('');
        setIsRefreshing(false);
        setIsLoadingMore(false);
      });
      return () => {
        active = false;
      };
    }

    void getCachedNotifications(userId)
      .then((cached) => {
        if (!active || generation !== remoteGenerationRef.current) return;
        setItems(cached?.items ?? []);
        setNextCursor(cached?.nextCursor ?? '');
        setFetchedAt(cached?.fetchedAt ?? '');
        setLoadedUserId(userId);
        setError('');
        setIsRefreshing(false);
        setIsLoadingMore(false);
      })
      .catch((cacheError) => {
        if (!active || generation !== remoteGenerationRef.current) return;
        console.warn('[NotificationsPage] cache hydration failed:', cacheError);
        setItems([]);
        setNextCursor('');
        setFetchedAt('');
        setLoadedUserId(userId);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const feedIsCurrent = Boolean(userId) && loadedUserId === userId;

  const refresh = useCallback(async () => {
    if (
      preview ||
      !feedIsCurrent ||
      !userId ||
      connectivity.status !== 'online'
    ) {
      return;
    }

    const generation = ++remoteGenerationRef.current;
    setIsLoadingMore(false);
    setIsRefreshing(true);
    setError('');
    try {
      const page = await fetchNotifications('', 30);
      if (generation !== remoteGenerationRef.current) return;

      let nextItems = page.items;
      setItems(nextItems);
      setNextCursor(page.nextCursor);
      setFetchedAt(page.fetchedAt);
      await setCachedNotifications(userId, page);
      if (generation !== remoteGenerationRef.current) return;

      const unreadIds = nextItems
        .filter((item) => !item.readAt)
        .map((item) => item.id);
      if (unreadIds.length > 0) {
        try {
          await markNotificationsRead(unreadIds);
          if (generation !== remoteGenerationRef.current) return;
          const readAt = new Date().toISOString();
          const readSet = new Set(unreadIds);
          nextItems = nextItems.map((item) =>
            readSet.has(item.id) ? { ...item, readAt } : item
          );
          setItems(nextItems);
          await setCachedNotifications(userId, {
            ...page,
            items: nextItems,
          });
        } catch (readError) {
          console.warn('[NotificationsPage] mark read failed:', readError);
        }
      }
    } catch (cause) {
      if (generation !== remoteGenerationRef.current) return;
      console.error('[NotificationsPage] refresh failed:', cause);
      setError('Could not refresh activity.');
    } finally {
      if (generation === remoteGenerationRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [
    connectivity.status,
    feedIsCurrent,
    preview,
    userId,
  ]);

  useEffect(() => {
    if (
      preview ||
      !feedIsCurrent ||
      connectivity.status !== 'online'
    ) {
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [
    connectivity.status,
    feedIsCurrent,
    preview,
    refresh,
  ]);

  useEffect(() => {
    if (preview || !feedIsCurrent) return;
    const handleFocus = () => void refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [feedIsCurrent, preview, refresh]);

  const visibleItems = feedIsCurrent ? items : [];
  const visibleNextCursor = feedIsCurrent ? nextCursor : '';
  const visibleFetchedAt = feedIsCurrent ? fetchedAt : '';

  const loadMore = async () => {
    if (
      preview ||
      !feedIsCurrent ||
      !userId ||
      !visibleNextCursor ||
      isLoadingMore ||
      connectivity.status !== 'online'
    ) {
      return;
    }

    const generation = ++remoteGenerationRef.current;
    setIsRefreshing(false);
    setIsLoadingMore(true);
    setError('');
    try {
      const page = await fetchNotifications(visibleNextCursor, 30);
      if (generation !== remoteGenerationRef.current) return;

      let merged = [
        ...visibleItems,
        ...page.items.filter(
          (candidate) =>
            !visibleItems.some((item) => item.id === candidate.id)
        ),
      ];
      const unreadIds = page.items
        .filter((item) => !item.readAt)
        .map((item) => item.id);
      if (unreadIds.length > 0) {
        try {
          await markNotificationsRead(unreadIds);
          if (generation !== remoteGenerationRef.current) return;
          const readAt = new Date().toISOString();
          const readSet = new Set(unreadIds);
          merged = merged.map((item) =>
            readSet.has(item.id) ? { ...item, readAt } : item
          );
        } catch (readError) {
          console.warn('[NotificationsPage] mark read failed:', readError);
        }
      }
      if (generation !== remoteGenerationRef.current) return;
      setItems(merged);
      setNextCursor(page.nextCursor);
      setFetchedAt(page.fetchedAt);
      await setCachedNotifications(userId, {
        items: merged,
        nextCursor: page.nextCursor,
        fetchedAt: page.fetchedAt,
      });
    } catch (cause) {
      if (generation !== remoteGenerationRef.current) return;
      console.error('[NotificationsPage] load more failed:', cause);
      setError('Could not load more activity.');
    } finally {
      if (generation === remoteGenerationRef.current) {
        setIsLoadingMore(false);
      }
    }
  };

  const patchTask = useCallback(
    (taskId: string, reactions: string) => {
      if (!feedIsCurrent) return;
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
    [feedIsCurrent, userId]
  );

  const handleReaction = useCallback(
    async (item: NotificationItem, emoji: string) => {
      if (
        preview ||
        !feedIsCurrent ||
        !userId ||
        connectivity.status !== 'online'
      ) {
        return;
      }

      const generation = remoteGenerationRef.current;
      const current = parseReactions(item.task.reactions);
      const op = hasUserReacted(current, emoji, userId)
        ? 'remove'
        : 'add';
      const optimistic = stringifyReactions(
        applyReactionDelta(current, emoji, userId, op)
      );
      const original = item.task.reactions ?? '';
      patchTask(item.task.id, optimistic);

      let confirmed: string;
      try {
        const serverReactions = await reactToTaskOnRemote(
          item.task.id,
          item.actorId,
          emoji,
          op
        );
        if (generation !== remoteGenerationRef.current) return;
        confirmed = serverReactions || optimistic;
        patchTask(item.task.id, confirmed);
      } catch (cause) {
        if (generation === remoteGenerationRef.current) {
          patchTask(item.task.id, original);
          console.error('[NotificationsPage] task reaction failed:', cause);
        }
        return;
      }

      if (op === 'add') {
        try {
          await sendTaskReaction(
            item.actorId,
            { ...item.task, reactions: confirmed },
            emoji,
            item.categoryColor
          );
        } catch (cause) {
          console.error(
            '[NotificationsPage] reaction message failed:',
            cause
          );
        }
      }
    },
    [
      connectivity.status,
      feedIsCurrent,
      patchTask,
      preview,
      sendTaskReaction,
      userId,
    ]
  );

  const groups = groupActivity(visibleItems);
  const canInteract =
    !preview && feedIsCurrent && connectivity.status === 'online';
  const currentReactionTarget =
    feedIsCurrent &&
    reactionTarget &&
    visibleItems.some((item) => item.id === reactionTarget.id)
      ? reactionTarget
      : null;
  const currentReplyTarget =
    feedIsCurrent &&
    replyTarget &&
    visibleItems.some((item) => item.id === replyTarget.id)
      ? replyTarget
      : null;
  const isInitialLoading = Boolean(userId) && !feedIsCurrent;

  const loadMoreButton = visibleNextCursor ? (
    <button
      type="button"
      onClick={() => void loadMore()}
      disabled={
        preview ||
        isLoadingMore ||
        connectivity.status !== 'online'
      }
      className="mt-6 w-full rounded-xl bg-[#1E1E1E] px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-[#252525] disabled:opacity-40"
    >
      {isLoadingMore ? 'Loading…' : 'Load more'}
    </button>
  ) : null;

  return (
    <div className="min-h-full bg-[#111111] text-white">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#2A2A2A] bg-[#111111] px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">Alerts</h1>
          {visibleFetchedAt && (
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
          disabled={
            preview ||
            !feedIsCurrent ||
            isRefreshing ||
            connectivity.status !== 'online'
          }
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

      {isInitialLoading ? (
        <div
          className="flex min-h-[55vh] items-center justify-center"
          role="status"
        >
          <Spinner size="w-7 h-7" />
          <span className="sr-only">Loading alerts</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1E1E1E]">
            <Bell
              size={24}
              className="text-gray-400"
              aria-hidden="true"
            />
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
          <div className="w-full max-w-sm">{loadMoreButton}</div>
        </div>
      ) : (
        <div className="px-4 pb-28 pt-3">
          {error && (
            <p
              className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="space-y-5">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-label={`${group.actorName} activity`}
              >
                <div className="mb-2 flex items-center gap-3">
                  <DeferredAvatar
                    fileId={group.actorAvatarFileId || undefined}
                    alt={group.actorName}
                    size="sm"
                  />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">
                      {group.actorName}
                    </span>{' '}
                    <span className="text-gray-300">
                      completed {group.items.length}{' '}
                      {group.items.length === 1 ? 'item' : 'items'}.
                    </span>{' '}
                    <span className="text-gray-500">
                      {formatDistanceToNow(
                        new Date(group.occurredAt),
                        { addSuffix: true }
                      )}
                    </span>
                  </p>
                </div>

                <div className="ml-5 border-l-2 border-[#3A3A3A] pl-4">
                  <div className="divide-y divide-[#2A2A2A]">
                    {group.items.map((item) => {
                      const reactions = parseReactions(
                        item.task.reactions
                      );
                      return (
                        <div key={item.id} className="py-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                              style={{
                                backgroundColor:
                                  item.categoryColor,
                                color: getReadableTextColor(
                                  item.categoryColor
                                ),
                              }}
                              aria-hidden="true"
                            >
                              <Check
                                size={10}
                                strokeWidth={3.5}
                              />
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
                                      void handleReaction(
                                        item,
                                        emoji
                                      )
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
                                onClick={() =>
                                  setReplyTarget(item)
                                }
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#252525] hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                                aria-label={`Reply to ${item.task.title}`}
                              >
                                <MessageSquare size={16} />
                              </motion.button>
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.9 }}
                                disabled={!canInteract}
                                onClick={() =>
                                  setReactionTarget(item)
                                }
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
          {loadMoreButton}
        </div>
      )}

      <EmojiPickerSheet
        isOpen={Boolean(currentReactionTarget)}
        onClose={() => setReactionTarget(null)}
        onPick={(emoji) => {
          if (currentReactionTarget) {
            void handleReaction(currentReactionTarget, emoji);
          }
        }}
      />

      <ReplyComposerSheet
        isOpen={Boolean(currentReplyTarget)}
        onClose={() => setReplyTarget(null)}
        task={currentReplyTarget?.task ?? null}
        categoryColor={currentReplyTarget?.categoryColor ?? ''}
        friendId={currentReplyTarget?.actorId ?? null}
        friendName={currentReplyTarget?.actorName ?? 'Friend'}
      />
    </div>
  );
};
