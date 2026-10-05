import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Search } from 'lucide-react';
import { DeferredAvatar } from '../components/ui/DeferredAvatar';
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
import { useMessages } from '../hooks/useMessages';
import { useFriends } from '../hooks/useFriends';
import { useAuth } from '../hooks/useAuth';
import { useConnectivity } from '../hooks/useConnectivity';
import { useChatScroll } from '../components/messages/useChatScroll';
import { useChatSearch } from '../components/messages/useChatSearch';
import { useChatReactions } from '../components/messages/useChatReactions';
import {
  buildRenderItems,
  messageMatchesQuery,
} from '../components/messages/chatRenderItems';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';

interface ComposerReplyState {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
}

const ChatMessagesLoadingShell: React.FC = () => (
  <div
    className="flex min-h-full flex-col justify-end gap-3 pb-2"
    role="status"
    aria-label="Loading messages"
  >
    <div className="h-10 w-2/3 rounded-2xl bg-[#1A1A1A]" aria-hidden="true" />
    <div className="ml-auto h-14 w-3/4 rounded-2xl bg-[#2A2A2A]" aria-hidden="true" />
    <div className="h-12 w-1/2 rounded-2xl bg-[#1A1A1A]" aria-hidden="true" />
    <span className="sr-only">Loading messages</span>
  </div>
);

export const ChatPage: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const connectivity = useConnectivity();
  const myUserId = user?.$id ?? '';

  const {
    messages,
    isLoading,
    sendMessage,
    markAllRead,
    unsendMessage,
    toggleReaction,
  } = useMessages(friendId ?? null);

  const { friends } = useFriends();
  const friend = useMemo(
    () => friends.find((f) => f.friendId === friendId) ?? null,
    [friends, friendId]
  );

  const composerRef = useRef<MessageComposerHandle>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ComposerReplyState | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [unsendTargetId, setUnsendTargetId] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);

  const actionMessage = useMemo(
    () => messages.find((m) => m.id === actionMessageId) ?? null,
    [messages, actionMessageId]
  );
  const unsendTarget = useMemo(
    () => messages.find((m) => m.id === unsendTargetId) ?? null,
    [messages, unsendTargetId]
  );
  const reactionTarget = useMemo(
    () => messages.find((m) => m.id === reactionTargetId) ?? null,
    [messages, reactionTargetId]
  );

  const {
    isSearching,
    searchQuery,
    openSearch: startSearch,
    closeSearch,
    setSearchQuery,
  } = useChatSearch();

  const {
    scrollRef,
    contentRef,
    showScrollButton,
    hasUnreadBelow,
    scrollToBottom,
    suspendFollowing,
    captureSearchPosition,
  } = useChatScroll({
    messages,
    isSearching,
    conversationKey: `${myUserId}:${friendId}`,
    isLoading,
  });

  const openSearch = useCallback(() => {
    captureSearchPosition();
    startSearch();
  }, [captureSearchPosition, startSearch]);

  const { reactToMessage } = useChatReactions({
    toggleReaction,
    setFeedback,
  });

  const statusById = useMemo(() => {
    const map = new Map<string, MessageStatusKind>();
    for (const m of messages) {
      if (m.direction === 'outgoing') {
        if (m.readAt) {
          map.set(m.id, 'read');
        } else if (m.deliveryStatus === 'delivered') {
          map.set(m.id, 'delivered');
        } else {
          map.set(m.id, 'pending');
        }
      }
    }
    return map;
  }, [messages]);

  const resolveSenderName = useMemo(
    () => (senderId: string): string => {
      if (senderId === myUserId) return 'You';
      return friend?.friendDisplayName || friend?.friendUsername || 'Friend';
    },
    [myUserId, friend]
  );

  const trimmedQuery = searchQuery.trim();

  const renderItems = useMemo(
    () => buildRenderItems(messages, isSearching, trimmedQuery),
    [messages, isSearching, trimmedQuery]
  );

  const searchMatchCount = useMemo(
    () => messages.filter((m) => messageMatchesQuery(m, trimmedQuery)).length,
    [messages, trimmedQuery]
  );

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (connectivity.status !== 'online') return;
      if (!myUserId) return;
      void import('../db/sync')
        .then(({ forceMessageSync }) => forceMessageSync(myUserId))
        .catch((syncError) =>
          console.error('[ChatPage] Poll sync failed:', syncError)
        );
    }, 30000);
    return () => clearInterval(interval);
  }, [connectivity.status, myUserId]);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') {
        if (isSearching) {
          closeSearch();
        } else if (replyTo) {
          setReplyTo(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching, replyTo, openSearch, closeSearch]);

  const handleBack = () => {
    const parent = '/messages';
    if (hasExpectedRouteParent(location.key, location.state, parent)) {
      navigate(-1);
    } else {
      navigate(parent, { replace: true });
    }
  };

  const handleSend = async (content: string) => {
    closeSearch();
    const reply = replyTo
      ? {
          id: replyTo.id,
          senderId: replyTo.senderId,
          content: replyTo.content,
        }
      : undefined;
    await sendMessage(content, reply);
    setReplyTo(null);
  };

  const handleUnsend = async () => {
    if (!unsendTarget) return;
    await unsendMessage(unsendTarget.id);
    setUnsendTargetId(null);
  };

  const handleQuoteTap = (targetMessageId: string) => {
    const el = document.getElementById(`msg-${targetMessageId}`);
    if (el) {
      suspendFollowing();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleReplyFromSheet = () => {
    if (actionMessage) {
      setReplyTo({
        id: actionMessage.id,
        senderId: actionMessage.senderId,
        senderName: resolveSenderName(actionMessage.senderId),
        content: actionMessage.content,
      });
      setActionMessageId(null);
      setTimeout(() => composerRef.current?.focus(), 50);
    }
  };

  const handleBubbleReact = (messageId: string, emoji: string) => {
    reactToMessage(messageId, emoji);
  };

  const handleEmojiPicked = (emoji: string) => {
    if (reactionTarget) {
      reactToMessage(reactionTarget.id, emoji);
    }
    setReactionTargetId(null);
  };

  const handleMoreEmojiFromSheet = () => {
    if (actionMessage) {
      setReactionTargetId(actionMessage.id);
    }
    setActionMessageId(null);
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden bg-[#111111]">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A]">
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
          {friend?.friendDisplayName || friend?.friendUsername || 'Chat'}
        </span>
        <div className="ml-auto">
          <button
            onClick={openSearch}
            className="p-2 text-gray-400"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </div>
      </div>
      {isSearching && (
        <ChatSearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          matchCount={searchMatchCount}
          totalCount={messages.length}
          onClose={closeSearch}
        />
      )}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        data-testid="chat-scroller"
      >
        <div
          ref={contentRef}
          className="min-h-full px-4 pt-4 pb-3 space-y-1"
        >
          {isLoading ? (
            <ChatMessagesLoadingShell />
          ) : renderItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare size={48} />
              <p className="mt-2 text-sm">
                {isSearching ? 'No matches' : 'No messages yet'}
              </p>
            </div>
          ) : (
            renderItems.map((item) =>
              item.kind === 'divider' ? (
                <div
                  key={item.key}
                  className="text-center text-xs text-gray-400 py-2"
                >
                  {item.label}
                </div>
              ) : (
                <div key={item.key} id={`msg-${item.message.id}`}>
                  <MessageBubble
                    message={item.message}
                    isOutgoing={item.message.direction === 'outgoing'}
                    currentUserId={myUserId}
                    showTimestamp={item.showTimestamp}
                    statusKind={statusById.get(item.message.id)}
                    resolveSenderName={resolveSenderName}
                    onLongPress={(m) => setActionMessageId(m.id)}
                    onQuoteTap={handleQuoteTap}
                    onReact={handleBubbleReact}
                    onSwipeReply={(m) => {
                      setReplyTo({
                        id: m.id,
                        senderId: m.senderId,
                        senderName: resolveSenderName(m.senderId),
                        content: m.content,
                      });
                      setTimeout(() => composerRef.current?.focus(), 50);
                    }}
                    gesturesDisabled={false}
                  />
                </div>
              )
            )
          )}
        </div>
      </div>

      <div
        className="relative shrink-0 z-30"
        data-testid="chat-dock"
      >
        <ScrollToBottomButton
          visible={showScrollButton}
          hasNewMessages={hasUnreadBelow}
          onClick={() => scrollToBottom()}
          className="pointer-events-auto bottom-[calc(100%+0.5rem)]"
        />
        <MessageComposer
          ref={composerRef}
          onSend={handleSend}
          disabled={!friendId}
          placeholder="Message..."
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      <MessageActionSheet
        isOpen={!!actionMessage}
        onClose={() => setActionMessageId(null)}
        message={actionMessage}
        isOwn={actionMessage?.senderId === myUserId}
        currentUserId={myUserId}
        onReply={handleReplyFromSheet}
        onCopy={() => {
          if (actionMessage) {
            navigator.clipboard.writeText(actionMessage.content);
          }
          setActionMessageId(null);
        }}
        onUnsend={() => {
          if (actionMessage) {
            setUnsendTargetId(actionMessage.id);
          }
          setActionMessageId(null);
        }}
        onReact={(emoji) => {
          if (actionMessage) {
            reactToMessage(actionMessage.id, emoji);
          }
          setActionMessageId(null);
        }}
        onMoreEmoji={handleMoreEmojiFromSheet}
      />
      <EmojiPickerSheet
        isOpen={!!reactionTarget}
        onClose={() => setReactionTargetId(null)}
        onPick={handleEmojiPicked}
      />
      <BottomSheet
        isOpen={!!unsendTarget}
        onClose={() => setUnsendTargetId(null)}
        title="Unsend Message"
        isLocked
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-400 text-sm mb-4">
            This message will be removed for everyone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setUnsendTargetId(null)}
              className="flex-1 py-3 rounded-lg bg-[#2A2A2A] text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleUnsend}
              className="flex-1 py-3 rounded-lg bg-red-600 text-white"
            >
              Unsend
            </button>
          </div>
        </div>
      </BottomSheet>
      {feedback && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {feedback}
        </div>
      )}
    </div>
  );
};
