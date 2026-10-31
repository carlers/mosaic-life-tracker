import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Search } from 'lucide-react';
import { DeferredAvatar } from '../components/ui/DeferredAvatar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useRetainedSheetValue } from '../hooks/useRetainedSheetValue';
import { ChatSyncSheet } from '../components/messages/ChatSyncSheet';
import type { ChatSyncStage } from '../lib/chatReconcile';
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
import { useDiaryReferencePreviews } from '../hooks/useDiaryReferencePreviews';
import { clearDeniedOutgoing, isDeniedOutgoing, subscribeDeniedOutgoing } from '../lib/messageSendDenials';
import { retryDeniedOutgoing } from '../lib/messageDelivery';
import { useFriends } from '../hooks/useFriends';
import { useAuth } from '../hooks/useAuth';
import { useConnectivity } from '../hooks/useConnectivity';
import { useSettings } from '../hooks/useSettings';
import { useAppearance } from '../hooks/useAppearance';
import { GIPHY_AUTOPLAY_SETTING_KEY } from '../lib/preferences';
import { useChatScroll } from '../components/messages/useChatScroll';
import { useChatSearch } from '../components/messages/useChatSearch';
import { useChatReactions } from '../components/messages/useChatReactions';
import {
  buildRenderItems,
  messageMatchesQuery,
} from '../components/messages/chatRenderItems';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';
import { packStickerMessage } from '../lib/stickerPacks';
import { giphyStickerMessage, sendGiphyAnalytics, type GiphySticker } from '../lib/giphyStickers';
import { createPreloadedLazy } from '../lib/createPreloadedLazy';

const DiaryReferenceSheet = React.lazy(() => import('../components/messages/DiaryReferenceSheet').then(m => ({ default: m.DiaryReferenceSheet })));

const { Component: StickerPackSheet, preload: preloadStickerPackSheet } =
  createPreloadedLazy(() =>
    import('../components/messages/StickerPackSheet').then(m => m.StickerPackSheet)
  );


interface ComposerReplyState {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
}

const ChatMessagesLoadingShell: React.FC = () => (
  <div className="flex min-h-full flex-col justify-end gap-3 pb-2" role="status">
    <div className="h-10 w-2/3 rounded-2xl bg-[#1A1A1A]" />
    <div className="ml-auto h-14 w-3/4 rounded-2xl bg-[#2A2A2A]" />
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
  const { getSetting } = useSettings();
  const { effectiveReducedMotion } = useAppearance();
  const autoplayGiphy = getSetting(GIPHY_AUTOPLAY_SETTING_KEY, false) === true;

  const {
    messages,
    isLoading,
    sendMessage,
    markAllRead,
    unsendMessage,
    toggleReaction,
  } = useMessages(friendId ?? null);

  const diaryPreviews = useDiaryReferencePreviews(messages, myUserId, connectivity.status === 'online');

  const [denialRevision, setDenialRevision] = useState(0);
  useEffect(() => subscribeDeniedOutgoing(() => setDenialRevision(value => value + 1)), []);

  const { friends } = useFriends();
  const friend = useMemo(
    () => friends.find((f) => f.friendId === friendId) ?? null,
    [friends, friendId]
  );

  const composerRef = useRef<MessageComposerHandle>(null);
  const focusAfterActionReplyRef = useRef(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncingChat, setSyncingChat] = useState<string | null>(null);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const [syncDetails, setSyncDetails] = useState<{
    key: string;
    stage: ChatSyncStage | 'failed';
    repaired: number | null;
    error: string | null;
  } | null>(null);
  const chatKey = myUserId + ':' + friendId;
  const chatKeyRef = useRef(chatKey);
  useEffect(() => { chatKeyRef.current = chatKey; }, [chatKey]);
  const [replyTo, setReplyTo] = useState<ComposerReplyState | null>(null);
  const [stickerPacksOpen, setStickerPacksOpen] = useState(false);
  const [hasOpenedStickers, setHasOpenedStickers] = useState(false);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [unsendTargetId, setUnsendTargetId] = useState<string | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [selectedDiaryReference, setSelectedDiaryReference] = useState<{ id: string; ownerId: string; date: string } | null>(null);
  const { value: diaryReferenceSession, onExitComplete: clearDiaryReferenceSession } = useRetainedSheetValue(
    selectedDiaryReference && myUserId
      ? { id: `${myUserId}:${selectedDiaryReference.id}`, viewerId: myUserId, reference: selectedDiaryReference }
      : null,
    Boolean(selectedDiaryReference && myUserId)
  );

  // Never mount sticker hooks until requested; warm code on usable Chat.
  useEffect(() => {
    if (!myUserId || !friendId) return;
    const id = setTimeout(() => {
      if (!document.hidden) void preloadStickerPackSheet().catch(() => {});
    }, 1000);
    return () => clearTimeout(id);
  }, [friendId, myUserId]);

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
          map.set(m.id, isDeniedOutgoing(myUserId, m.id) ? 'not-sent' : 'pending');
        }
      }
    }
    return map;
  }, [messages, myUserId, denialRevision]);

  useEffect(() => {
    if (!myUserId) return;
    for (const message of messages) {
      if (message.direction === 'outgoing' &&
          (message.deliveryStatus === 'delivered' || message.readAt || message.isUnsent)) {
        clearDeniedOutgoing(myUserId, message.id);
      }
    }
  }, [messages, myUserId]);

  const handleRetryDenied = useCallback((messageId: string) => {
    void retryDeniedOutgoing(myUserId, messageId).catch(() => {
      setFeedback('Could not retry message. Try again.');
    });
  }, [myUserId]);

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
          e.preventDefault();
          closeSearch();
        } else if (replyTo) {
          e.preventDefault();
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

  const handleSyncChat = async () => {
    if (syncingChat === chatKey) {
      setSyncDetailsOpen(true);
      return;
    }
    if (!myUserId || !friendId || connectivity.status !== 'online') return;
    const key = chatKey;
    setSyncingChat(key);
    setSyncDetails({ key, stage: 'sending', repaired: null, error: null });
    setSyncDetailsOpen(true);
    try {
      const { reconcileChat } = await import('../lib/chatReconcile');
      const count = await reconcileChat(myUserId, friendId, (progress) => {
        if (chatKeyRef.current !== key) return;
        setSyncDetails({
          key, stage: progress.stage, repaired: progress.repaired ?? null, error: null,
        });
      });
      if (chatKeyRef.current === key)
        setFeedback(count ? `Recovered ${count} messages` : 'Chat synced');
    } catch (err) {
      if (chatKeyRef.current === key) {
        const message = err instanceof Error ? err.message : 'Unknown sync error';
        setSyncDetails((previous) => previous?.key === key
          ? { ...previous, stage: 'failed', error: message.slice(0, 240) }
          : previous);
      }
    } finally {
      setSyncingChat((current) => current === key ? null : current);
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

  const handlePickSticker = async (packId: string, stickerId: string) => {
    setStickerPacksOpen(false);
    try {
      await handleSend(packStickerMessage(packId, stickerId));
    } catch {
      setFeedback('Could not queue sticker. Try again.');
    }
  };

  const handlePickGiphySticker = async (sticker: GiphySticker) => {
    setStickerPacksOpen(false);
    try {
      await handleSend(giphyStickerMessage(sticker));
      sendGiphyAnalytics(sticker, 'onsent');
    } catch {
      setFeedback('Could not queue GIPHY sticker. Try again.');
    }
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
      // The action sheet traps focus until its exit animation completes.
      focusAfterActionReplyRef.current = true;
      setActionMessageId(null);
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
        <span className="font-medium min-w-0 truncate">
          {friend?.friendDisplayName || friend?.friendUsername || 'Chat'}
        </span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => void handleSyncChat()}
            disabled={connectivity.status !== 'online' && syncingChat !== chatKey}
            aria-label={syncingChat === chatKey ? 'View chat sync progress' : 'Sync chat now'}
            data-route-swipe-ignore="true"
            className="p-2 text-sm text-gray-400 disabled:opacity-50">
            {syncingChat === chatKey ? 'Syncing' : 'Sync'}
          </button>
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
              <p className="mosaic-general-text mt-2 text-sm">
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
                    diaryReferencePreview={diaryPreviews[item.message.id] ?? null}
                    isOutgoing={item.message.direction === 'outgoing'}
                    currentUserId={myUserId}
                    autoplayGiphy={autoplayGiphy}
                    reducedMotion={effectiveReducedMotion}
                    showTimestamp={item.showTimestamp}
                    statusKind={statusById.get(item.message.id)}
                    onRetrySend={handleRetryDenied}
                    resolveSenderName={resolveSenderName}
                    onLongPress={(m) => setActionMessageId(m.id)}
                    onQuoteTap={handleQuoteTap}
                    onDiaryRefTap={m => {
                      const current = diaryPreviews[m.id];
                      if (!current || !m.diaryRefId || !m.diaryRefOwnerId ||
                        (m.diaryRefOwnerId !== myUserId && m.diaryRefOwnerId !== friendId)) return;
                      setSelectedDiaryReference({ id: m.diaryRefId, ownerId: m.diaryRefOwnerId, date: current.date });
                    }}
                    onReact={handleBubbleReact}
                    onSwipeReply={(m) => {
                      // iOS WebKit only reliably summons the software keyboard
                      // when focus occurs during the originating user gesture
                      // (the reply swipe's pointerup), not in an effect/RAF.
                      // The composer already exists; focus before React updates.
                      composerRef.current?.focus();
                      setReplyTo({
                        id: m.id,
                        senderId: m.senderId,
                        senderName: resolveSenderName(m.senderId),
                        content: m.content,
                      });
                    }}
                    gesturesDisabled={!!actionMessage || !!reactionTarget || !!unsendTarget}
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
          onSendError={() => setFeedback('Message not saved. Retry.')}
          onOpenStickers={() => { setHasOpenedStickers(true); setStickerPacksOpen(true); }}
          onPrepareStickers={() => { void preloadStickerPackSheet().catch(() => {}); }}
          disabled={!friendId}
          placeholder="Message..."
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      {hasOpenedStickers && (
          <StickerPackSheet
            key={myUserId}
            isOpen={stickerPacksOpen}
            onClose={() => setStickerPacksOpen(false)}
            ownerId={myUserId}
            onPick={handlePickSticker}
            onPickGiphy={handlePickGiphySticker}
          />
      )}
      {myUserId && diaryReferenceSession?.viewerId === myUserId && <React.Suspense fallback={null}>
        <DiaryReferenceSheet key={diaryReferenceSession.id} reference={diaryReferenceSession.reference}
          isOpen={selectedDiaryReference !== null} onExitComplete={clearDiaryReferenceSession}
          onClose={() => setSelectedDiaryReference(null)} />
      </React.Suspense>}
      <MessageActionSheet
        isOpen={!!actionMessage}
        onClose={() => setActionMessageId(null)}
        message={actionMessage}
        isOwn={actionMessage?.senderId === myUserId}
        currentUserId={myUserId}
        onReply={handleReplyFromSheet}
        onClosed={() => {
          if (!focusAfterActionReplyRef.current) return;
          focusAfterActionReplyRef.current = false;
          // BottomSheet restores the previous focus on the frame after releasing
          // app inertness. Focus the composer after that restoration, not during
          // the sheet's closing animation.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            composerRef.current?.focus();
          }));
        }}
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
      <ChatSyncSheet
        isOpen={syncDetailsOpen && syncDetails?.key === chatKey}
        onClose={() => setSyncDetailsOpen(false)}
        stage={syncDetails?.stage ?? 'sending'}
        repaired={syncDetails?.repaired ?? null}
        error={syncDetails?.error ?? null}
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
