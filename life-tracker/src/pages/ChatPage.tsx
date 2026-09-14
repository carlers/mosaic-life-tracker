import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { format, isSameDay, subDays } from 'date-fns';
import { Avatar } from '../components/ui/Avatar';
import {
  MessageBubble,
  type MessageStatusKind,
} from '../components/messages/MessageBubble';
import { MessageComposer } from '../components/messages/MessageComposer';
import { useMessages } from '../hooks/useMessages';
import { useFriends } from '../hooks/useFriends';
import { useTaskImage } from '../hooks/useTaskImage';
import { forceSync } from '../db/sync';
import type { MessageDocument } from '../db/schema';

const TIMESTAMP_GAP_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;

type RenderItem =
  | { kind: 'divider'; key: string; label: string }
  | {
      kind: 'message';
      key: string;
      message: MessageDocument;
      showTimestamp: boolean;
    };

function dateDividerLabel(date: Date): string {
  const today = new Date();
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, subDays(today, 1))) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
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

  const { messages, isLoading, sendMessage, markAllRead } = useMessages(
    friend ? friend.friendId : null
  );
  const { imageUrl } = useTaskImage(friend?.friendAvatarFileId || undefined);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgId =
    messages.length > 0 ? messages[messages.length - 1].id : null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!lastMsgId) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [lastMsgId]);

  // Mark all incoming as read whenever the thread has unread
  useEffect(() => {
    if (messages.length === 0) return;
    const hasUnread = messages.some(
      (m) => m.direction === 'incoming' && !m.readAt
    );
    if (hasUnread) {
      markAllRead().catch((err) =>
        console.error('[ChatPage] markAllRead failed:', err)
      );
    }
  }, [messages, markAllRead]);

  // Poll for remote updates (read receipts, new messages) while chat is open
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

  // Compute per-message status indicators under outgoing bubbles
  const statusById = useMemo(() => {
    const map = new Map<string, MessageStatusKind>();
    let lastOutgoing: MessageDocument | null = null;
    let lastReadOutgoing: MessageDocument | null = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.direction !== 'outgoing') continue;
      if (!lastOutgoing) lastOutgoing = m;
      if (m.readAt && !lastReadOutgoing) lastReadOutgoing = m;
      if (lastOutgoing && lastReadOutgoing) break;
    }

    // "Seen" indicator under the last message the recipient has actually read
    if (lastReadOutgoing) {
      map.set(lastReadOutgoing.id, 'read');
    }

    // Delivery indicator under the latest outgoing message, if it's a
    // different message than the "last read" one.
    if (lastOutgoing && lastOutgoing.id !== lastReadOutgoing?.id) {
      map.set(
        lastOutgoing.id,
        lastOutgoing.deliveryStatus === 'pending' ? 'pending' : 'delivered'
      );
    }

    return map;
  }, [messages]);

  // Render list with date dividers + gap-based timestamp flags
  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let lastDayKey = '';
    let lastTs = 0;
    messages.forEach((m) => {
      const created = new Date(m.createdAt);
      const dayKey = format(created, 'yyyy-MM-dd');
      if (dayKey !== lastDayKey) {
        items.push({
          kind: 'divider',
          key: `d-${dayKey}`,
          label: dateDividerLabel(created),
        });
        lastDayKey = dayKey;
        lastTs = 0;
      }
      const ts = created.getTime();
      const showTimestamp = ts - lastTs > TIMESTAMP_GAP_MS;
      items.push({
        kind: 'message',
        key: m.id,
        message: m,
        showTimestamp,
      });
      lastTs = ts;
    });
    return items;
  }, [messages]);

  const handleBack = () => navigate(-1);

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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
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
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
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
                showTimestamp={item.showTimestamp}
                statusKind={statusById.get(item.message.id)}
              />
            );
          })
        )}
      </div>

      <MessageComposer
        onSend={(content) => {
          sendMessage(content).catch((err) =>
            console.error('[ChatPage] sendMessage failed:', err)
          );
        }}
      />
    </div>
  );
};