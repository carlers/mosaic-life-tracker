import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Search } from 'lucide-react';
import { format, isSameDay, subDays } from 'date-fns';
import { Avatar } from '../components/ui/Avatar';
import { BottomSheet } from '../components/ui/BottomSheet';
import {
  MessageBubble,
  type MessageStatusKind,
} from '../components/messages/MessageBubble';
import {
  MessageComposer,
  type MessageComposerHandle,
} from '../components/messages/MessageComposer';
import { MessageActionSheet } from '../components/messages/MessageActionSheet';
import { EmojiPickerSheet } from '../components/messages/EmojiPickerSheet';
import { ScrollToBottomButton } from '../components/messages/ScrollToBottomButton';
import { ChatSearchBar } from '../components/messages/ChatSearchBar';
import { useMessages, type ReplyContext } from '../hooks/useMessages';
import { useFriends } from '../hooks/useFriends';
import { useTaskImage } from '../hooks/useTaskImage';
import { forceSync } from '../db/sync';
import type { MessageDocument } from '../db/schema';

const TIMESTAMP_GAP_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;
const SCROLL_FAB_THRESHOLD_PX = 300;

type RenderItem =
  | { kind: 'divider'; key: string; label: string }
  | {
      kind: 'message';
      key: string;
      message: MessageDocument;
      showTimestamp: boolean;
    };

interface ComposerReplyState {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
}

function dateDividerLabel(date: Date): string {
  const today = new Date();
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, subDays(today, 1))) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function messageMatchesQuery(m: MessageDocument, query: string): boolean {
  const q = query.toLowerCase();
  if (m.content.toLowerCase().includes(q)) return true;
  if (m.taskRefTitle.toLowerCase().includes(q)) return true;
  if (m.replyToContent.toLowerCase().includes(q)) return true;
  return false;
}

export const ChatPage: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { friends, isLoading: friendsLoading } = useFriends();
  const friend = useMemo(
    () =>
      friendId
        ? friends.find((f) => f.friendId === friendId) || null
        : null,
    [friendId, friends]
  );

  const {
    messages,
    isLoading,
    sendMessage,
    markAllRead,
    unsendMessage,
    toggleReaction,
  } = useMessages(friend ? friend.friendId : null);
  const { imageUrl } = useTaskImage(friend?.friendAvatarFileId || undefined);

  const [actionMessage, setActionMessage] = useState<MessageDocument | null>(
    null
  );
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [composerReply, setComposerReply] =
    useState<ComposerReplyState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [unsendTarget, setUnsendTarget] = useState<MessageDocument | null>(
    null
  );
  const [isUnsendConfirmOpen, setIsUnsendConfirmOpen] = useState(false);
  const [isUnsending, setIsUnsending] = useState(false);

  const [reactionTarget, setReactionTarget] = useState<MessageDocument | null>(
    null
  );
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Search
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll FAB
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lastAcknowledgedId, setLastAcknowledgedId] = useState<string | null>(
    null
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<MessageComposerHandle>(null);
  // Tracks whether the user was near the bottom *before* the latest render.
  // Updated synchronously inside the scroll handler so the auto-scroll effect
  // reads an accurate value for the current scroll position.
  const isPinnedToBottomRef = useRef(true);

  const lastMsgId =
    messages.length > 0 ? messages[messages.length - 1].id : null;

  const myUserId = useMemo(
    () => messages.find((m) => m.direction === 'outgoing')?.senderId || '',
    [messages]
  );

  const resolveSenderName = useCallback(
    (senderId: string): string => {
      if (senderId === myUserId) return 'You';
      if (friend && senderId === friend.friendId) {
        return friend.friendDisplayName || friend.friendUsername || 'Them';
      }
      return 'Unknown';
    },
    [myUserId, friend]
  );

  // Auto-scroll to bottom on new messages.
  // - Suppressed while searching.
  // - Outgoing messages always scroll (you just sent it).
  // - Incoming messages only scroll if the user was already pinned to bottom.
  useEffect(() => {
    if (!lastMsgId) return;
    if (isSearching) return;
    const el = scrollRef.current;
    if (!el) return;

    const lastMessage = messages[messages.length - 1];
    const isOutgoing = lastMessage?.direction === 'outgoing';
    const wasPinned = isPinnedToBottomRef.current;

    if (!isOutgoing && !wasPinned) {
      // User is reading history — leave them alone. The FAB indicates unread.
      return;
    }

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      isPinnedToBottomRef.current = true;
      setLastAcknowledgedId(lastMsgId);
    });
  }, [lastMsgId, isSearching, messages]);

  // Mark incoming as read
  useEffect(() => {
    if (messages.length === 0) return;
    const hasUnread = messages.some(
      (m) => m.direction === 'incoming' && !m.readAt && !m.isUnsent
    );
    if (hasUnread) {
      markAllRead().catch((err) =>
        console.error('[ChatPage] markAllRead failed:', err)
      );
    }
  }, [messages, markAllRead]);

  // Polling sync
  useEffect(() => {
    if (!friendId) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }
      forceSync().catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[ChatPage] poll sync failed:', err);
        }
      });
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [friendId]);

  // Feedback auto-dismiss
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(t);
  }, [feedback]);

  // Scroll listener drives the FAB visibility + acknowledgement + pinned flag
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf: number | null = null;
    const handleScroll = () => {
      // Update the pinned flag synchronously so the auto-scroll effect can
      // read the freshest value even before rAF runs.
      const distFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      isPinnedToBottomRef.current =
        distFromBottom < SCROLL_FAB_THRESHOLD_PX;

      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const shouldShow = !isPinnedToBottomRef.current;
        setShowScrollButton(shouldShow);
        if (!shouldShow && lastMsgId) {
          setLastAcknowledgedId(lastMsgId);
        }
      });
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [lastMsgId]);

  // Keyboard shortcuts
  const isOverlayOpen =
    isActionSheetOpen || isUnsendConfirmOpen || isEmojiPickerOpen;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Let sheets handle their own Escape
      if (isOverlayOpen) return;

      if (e.key === 'Escape') {
        if (isSearching) {
          setIsSearching(false);
          setSearchQuery('');
          return;
        }
        if (composerReply) {
          setComposerReply(null);
          return;
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault();
        setIsSearching(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayOpen, isSearching, composerReply]);

  const statusById = useMemo(() => {
    const map = new Map<string, MessageStatusKind>();
    let lastOutgoing: MessageDocument | null = null;
    let lastReadOutgoing: MessageDocument | null = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.direction !== 'outgoing') continue;
      if (m.isUnsent) continue;
      if (!lastOutgoing) lastOutgoing = m;
      if (m.readAt && !lastReadOutgoing) lastReadOutgoing = m;
      if (lastOutgoing && lastReadOutgoing) break;
    }

    if (lastReadOutgoing) {
      map.set(lastReadOutgoing.id, 'read');
    }
    if (lastOutgoing && lastOutgoing.id !== lastReadOutgoing?.id) {
      map.set(
        lastOutgoing.id,
        lastOutgoing.deliveryStatus === 'pending' ? 'pending' : 'delivered'
      );
    }
    return map;
  }, [messages]);

  // Search match count (independent of renderItems)
  const searchMatchCount = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return 0;
    return messages.filter((m) => messageMatchesQuery(m, q)).length;
  }, [messages, searchQuery]);

  const renderItems = useMemo<RenderItem[]>(() => {
    const trimmedQuery = searchQuery.trim();
    const isFiltering = isSearching && trimmedQuery.length > 0;

    const filtered = isFiltering
      ? messages.filter((m) => messageMatchesQuery(m, trimmedQuery))
      : messages;

    const items: RenderItem[] = [];
    let lastDayKey = '';
    let lastTs = 0;

    filtered.forEach((m) => {
      const created = new Date(m.createdAt);
      const dayKey = format(created, 'yyyy-MM-dd');

      // Hide date dividers while searching — the timeline is broken up.
      if (!isFiltering && dayKey !== lastDayKey) {
        items.push({
          kind: 'divider',
          key: `d-${dayKey}`,
          label: dateDividerLabel(created),
        });
        lastDayKey = dayKey;
        lastTs = 0;
      }

      const ts = created.getTime();
      const showTimestamp = !isFiltering && ts - lastTs > TIMESTAMP_GAP_MS;
      items.push({
        kind: 'message',
        key: m.id,
        message: m,
        showTimestamp,
      });
      lastTs = ts;
    });

    return items;
  }, [messages, isSearching, searchQuery]);

  const handleOpenActionSheet = useCallback((message: MessageDocument) => {
    if (message.isUnsent) return;
    setActionMessage(message);
    setIsActionSheetOpen(true);
  }, []);

  const handleReplyFromSheet = useCallback(() => {
    if (!actionMessage) return;
    setComposerReply({
      id: actionMessage.id,
      senderId: actionMessage.senderId,
      senderName: resolveSenderName(actionMessage.senderId),
      content: actionMessage.content || actionMessage.taskRefTitle || '',
    });
  }, [actionMessage, resolveSenderName]);

  const handleCopyFromSheet = useCallback(async () => {
    if (!actionMessage) return;

    const parts: string[] = [];
    if (actionMessage.content.trim()) {
      parts.push(actionMessage.content.trim());
    }
    if (actionMessage.taskRefTitle.trim()) {
      const refDate = actionMessage.taskRefDate
        ? format(
            new Date(`${actionMessage.taskRefDate}T00:00:00`),
            'MMM d, yyyy'
          )
        : '';
      parts.push(
        refDate
          ? `↳ ${actionMessage.taskRefTitle} (${refDate})`
          : `↳ ${actionMessage.taskRefTitle}`
      );
    }
    const text = parts.join('\n\n');
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setFeedback('Copied');
    } catch (err) {
      console.error('[ChatPage] Copy failed:', err);
      setFeedback('Copy failed');
    }
  }, [actionMessage]);

  const handleUnsendFromSheet = useCallback(() => {
    if (!actionMessage) return;
    setUnsendTarget(actionMessage);
    setIsUnsendConfirmOpen(true);
  }, [actionMessage]);

  const handleConfirmUnsend = useCallback(async () => {
    if (!unsendTarget || isUnsending) return;
    setIsUnsending(true);
    try {
      await unsendMessage(unsendTarget.id);
      setFeedback('Message unsent');
      setIsUnsendConfirmOpen(false);
      setUnsendTarget(null);
    } catch (err) {
      console.error('[ChatPage] Unsend failed:', err);
      setFeedback('Failed to unsend');
    } finally {
      setIsUnsending(false);
    }
  }, [unsendTarget, isUnsending, unsendMessage]);

  const handleCancelUnsend = useCallback(() => {
    setIsUnsendConfirmOpen(false);
    setUnsendTarget(null);
  }, []);

  const handleReactFromSheet = useCallback(
    (emoji: string) => {
      if (!actionMessage) return;
      toggleReaction(actionMessage.id, emoji).catch((err) =>
        console.error('[ChatPage] react failed:', err)
      );
    },
    [actionMessage, toggleReaction]
  );

  const handleMoreEmojiFromSheet = useCallback(() => {
    if (!actionMessage) return;
    setReactionTarget(actionMessage);
    setIsEmojiPickerOpen(true);
  }, [actionMessage]);

  const handleEmojiPicked = useCallback(
    (emoji: string) => {
      if (!reactionTarget) return;
      toggleReaction(reactionTarget.id, emoji).catch((err) =>
        console.error('[ChatPage] react failed:', err)
      );
      setReactionTarget(null);
    },
    [reactionTarget, toggleReaction]
  );

  const handleBubbleReact = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction(messageId, emoji).catch((err) =>
        console.error('[ChatPage] react failed:', err)
      );
    },
    [toggleReaction]
  );

  const handleSwipeReply = useCallback(
    (message: MessageDocument) => {
      if (message.isUnsent) return;
      setComposerReply({
        id: message.id,
        senderId: message.senderId,
        senderName: resolveSenderName(message.senderId),
        content: message.content || message.taskRefTitle || '',
      });
      setTimeout(() => composerRef.current?.focus(), 50);
    },
    [resolveSenderName]
  );

  const handleQuoteTap = useCallback((targetId: string) => {
    const el = document.querySelector(
      `[data-message-id="${targetId}"]`
    ) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { backgroundColor: 'transparent' },
        { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
        { backgroundColor: 'transparent' },
      ],
      { duration: 900, easing: 'ease-out' }
    );
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      const replyCtx: ReplyContext | undefined = composerReply
        ? {
            id: composerReply.id,
            senderId: composerReply.senderId,
            content: composerReply.content,
          }
        : undefined;
      sendMessage(content, replyCtx).catch((err) =>
        console.error('[ChatPage] sendMessage failed:', err)
      );
      setComposerReply(null);
    },
    [sendMessage, composerReply]
  );

  const handleScrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleOpenSearch = useCallback(() => {
    setIsSearching(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
  }, []);

  const handleBack = () => navigate(-1);

  const hasUnreadBelow =
    !!lastMsgId && lastMsgId !== lastAcknowledgedId;

  if (friendsLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
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
            <p className="text-sm text-gray-500">
              You can no longer message this user.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = friend.friendDisplayName || friend.friendUsername;
  const showEmptyState = messages.length === 0 && !isSearching;
  const showNoMatches =
    isSearching &&
    searchQuery.trim().length > 0 &&
    renderItems.length === 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 relative">
      <div className="sticky top-0 z-20 bg-[#111111] border-b border-[#333333] flex-shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <Avatar src={imageUrl || undefined} alt={displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              @{friend.friendUsername}
            </p>
          </div>
          {!isSearching && (
            <button
              onClick={handleOpenSearch}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors flex-shrink-0"
              aria-label="Search messages"
            >
              <Search size={18} />
            </button>
          )}
        </div>
      </div>

      {isSearching && (
        <ChatSearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          matchCount={searchMatchCount}
          totalCount={messages.length}
          onClose={handleCloseSearch}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : showNoMatches ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-3 border border-[#333333]">
              <Search size={22} className="text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              No messages match &quot;{searchQuery.trim()}&quot;
            </p>
          </div>
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-3 border border-[#333333]">
              <MessageSquare size={22} className="text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              Say hi to {displayName}. You can also reply to their tasks from
              their calendar.
            </p>
          </div>
        ) : (
          renderItems.map((item) => {
            if (item.kind === 'divider') {
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-center my-4"
                >
                  <div className="bg-[#1E1E1E] border border-[#333333] rounded-full px-3 py-1">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <MessageBubble
                key={item.key}
                message={item.message}
                isOutgoing={item.message.direction === 'outgoing'}
                currentUserId={myUserId}
                showTimestamp={item.showTimestamp}
                statusKind={statusById.get(item.message.id)}
                resolveSenderName={resolveSenderName}
                onLongPress={handleOpenActionSheet}
                onQuoteTap={handleQuoteTap}
                onReact={handleBubbleReact}
                onSwipeReply={handleSwipeReply}
                gesturesDisabled={isOverlayOpen}
              />
            );
          })
        )}
      </div>

      <MessageComposer
        ref={composerRef}
        onSend={handleSend}
        replyTo={composerReply}
        onCancelReply={() => setComposerReply(null)}
      />

      {!isSearching && (
        <ScrollToBottomButton
          visible={showScrollButton}
          hasNewMessages={hasUnreadBelow}
          onClick={handleScrollToBottom}
        />
      )}

      <MessageActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        message={actionMessage}
        isOwn={actionMessage?.direction === 'outgoing'}
        currentUserId={myUserId}
        onReply={handleReplyFromSheet}
        onCopy={handleCopyFromSheet}
        onUnsend={handleUnsendFromSheet}
        onReact={handleReactFromSheet}
        onMoreEmoji={handleMoreEmojiFromSheet}
      />

      <EmojiPickerSheet
        isOpen={isEmojiPickerOpen}
        onClose={() => {
          setIsEmojiPickerOpen(false);
          setReactionTarget(null);
        }}
        onPick={handleEmojiPicked}
      />

      <BottomSheet
        isOpen={isUnsendConfirmOpen}
        onClose={handleCancelUnsend}
        title="Unsend Message"
        height="auto"
        isLocked={true}
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
            Unsend this message? This will remove it for both of you. This
            cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancelUnsend}
              disabled={isUnsending}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUnsend}
              disabled={isUnsending}
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUnsending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Unsending…
                </>
              ) : (
                'Unsend'
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      {feedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          {feedback}
        </div>
      )}
    </div>
  );
};