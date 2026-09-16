import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Ban, Reply } from 'lucide-react';
import { TaskRefCard } from './TaskRefCard';
import { ReplyPreview } from './ReplyPreview';
import { ReactionRow } from './ReactionRow';
import {
  useBubbleGestures,
  type SwipeDirection,
} from '../../hooks/useBubbleGestures';
import { parseReactions } from '../../lib/reactionUtils';
import type { MessageDocument } from '../../db/schema';

export type MessageStatusKind = 'pending' | 'delivered' | 'read';

interface MessageBubbleProps {
  message: MessageDocument;
  isOutgoing: boolean;
  currentUserId: string;
  showTimestamp?: boolean;
  statusKind?: MessageStatusKind;
  resolveSenderName?: (senderId: string) => string;
  onLongPress?: (message: MessageDocument) => void;
  onQuoteTap?: (targetMessageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onSwipeReply?: (message: MessageDocument) => void;
  gesturesDisabled?: boolean;
}

const REVEAL_DURATION_MS = 2500;
const DOUBLE_TAP_EMOJI = '❤️';
const STATUS_ROW_MIN_HEIGHT_PX = 14;

// Build the bubble's accessible name from the message's parts. Kept as a
// helper so the reading order matches what a screen-reader user hears:
// sender, then task-ref title if present, then content, then reply quote.
function buildBubbleLabel(
  message: MessageDocument,
  isOutgoing: boolean,
  senderName: string,
  replySenderName: string
): string {
  const parts: string[] = [];
  parts.push(isOutgoing ? 'You' : senderName);
  if (message.taskRefTitle) {
    parts.push(`task ${message.taskRefTitle}`);
  }
  if (message.replyToId) {
    parts.push(
      `replying to ${replySenderName || 'a message'}: ${
        message.replyToContent || '(deleted)'
      }`
    );
  }
  if (message.content) {
    parts.push(message.content);
  }
  return parts.join(', ');
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  currentUserId,
  showTimestamp = false,
  statusKind,
  resolveSenderName,
  onLongPress,
  onQuoteTap,
  onReact,
  onSwipeReply,
  gesturesDisabled = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isUnsent = message.isUnsent;

  const swipeDirection: SwipeDirection = isOutgoing ? 'left' : 'right';
  const disabled = isUnsent || gesturesDisabled;

  const gestures = useBubbleGestures({
    swipeDirection,
    disabled,
    onSingleTap: () => {
      if (isUnsent) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setRevealed(true);
      timeoutRef.current = setTimeout(
        () => setRevealed(false),
        REVEAL_DURATION_MS
      );
    },
    onDoubleTap: () => {
      if (isUnsent) return;
      onReact?.(message.id, DOUBLE_TAP_EMOJI);
    },
    onLongPress: () => {
      if (isUnsent) return;
      onLongPress?.(message);
    },
    onSwipeReply: () => {
      if (isUnsent) return;
      onSwipeReply?.(message);
    },
    onContextMenu: () => {
      if (isUnsent) return;
      onLongPress?.(message);
    },
  });

  const { swipeOffset, isSwiping } = gestures;

  const timeLabel = format(new Date(message.createdAt), 'h:mm a');
  const readTimeLabel = message.readAt
    ? format(new Date(message.readAt), 'h:mm a')
    : '';
  const timestampVisible = showTimestamp || revealed || hovered;

  const items: React.ReactNode[] = [];
  if (statusKind === 'read') {
    items.push(
      <span key="status" className="flex items-center gap-0.5">
        <CheckCheck size={10} strokeWidth={3} />
        <span>Seen{readTimeLabel ? ` at ${readTimeLabel}` : ''}</span>
      </span>
    );
  } else if (statusKind === 'delivered') {
    items.push(
      <span key="status" className="flex items-center gap-0.5">
        <Check size={10} strokeWidth={3} />
        <span>Delivered</span>
      </span>
    );
  } else if (statusKind === 'pending') {
    items.push(<span key="status">Sending…</span>);
  }

  const showMessageTime = timestampVisible && statusKind !== 'read';
  if (showMessageTime) {
    items.push(<span key="time">{timeLabel}</span>);
  }
  const hasRowContent = items.length > 0;

  const replySenderName =
    message.replyToSenderId && resolveSenderName
      ? resolveSenderName(message.replyToSenderId)
      : '';
  const replyIsDeleted =
    !!message.replyToId && message.replyToContent.length === 0;

  const reactions = parseReactions(message.reactions);
  const showReactions = !isUnsent && reactions.length > 0;

  const bubbleBgClass = isOutgoing
    ? 'bg-[#1E1E1E] text-gray-100 border border-[#333333] rounded-br-md'
    : 'bg-black text-gray-100 border border-[#444444] rounded-bl-md';

  // ---- Unsent tombstone ----
  if (isUnsent) {
    return (
      <div
        data-message-id={message.id}
        className={`flex flex-col ${
          isOutgoing ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`max-w-[78%] rounded-2xl px-3 py-2 ${
            isOutgoing
              ? 'bg-[#1E1E1E]/60 border border-[#333333] rounded-br-md'
              : 'bg-black/60 border border-[#444444] rounded-bl-md'
          }`}
        >
          <p className="text-sm italic text-gray-300 flex items-center gap-1.5">
            <Ban size={12} aria-hidden="true" />
            Message deleted
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 mt-0.5 px-1 text-[10px] text-gray-500 transition-opacity duration-150"
          style={{ minHeight: `${STATUS_ROW_MIN_HEIGHT_PX}px` }}
        >
          {hasRowContent &&
            items.map((node, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-600">·</span>}
                {node}
              </React.Fragment>
            ))}
        </div>
      </div>
    );
  }

  // ---- Reply icon reveal ----
  const swipeProgress = Math.min(Math.abs(swipeOffset) / 60, 1);
  const replyIconOpacity = swipeProgress;
  const replyIconScale = 0.85 + swipeProgress * 0.25;
  const iconSideClass = isOutgoing ? 'right-0 pr-3' : 'left-0 pl-3';
  const iconTransition = isSwiping
    ? 'none'
    : 'opacity 220ms ease-out, transform 220ms ease-out';
  const bubbleTransition = isSwiping
    ? 'none'
    : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';

  const senderName = resolveSenderName ? resolveSenderName(message.senderId) : '';
  const ariaLabel = buildBubbleLabel(
    message,
    isOutgoing,
    senderName,
    replySenderName
  );

  return (
    <div
      data-message-id={message.id}
      className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
    >
      <div className="relative max-w-[78%]">
        {/* Reply icon sits behind the bubble; pointer-swipe affordance only */}
        <div
          className={`absolute top-0 bottom-0 flex items-center pointer-events-none ${iconSideClass}`}
          style={{
            opacity: replyIconOpacity,
            transform: `scale(${replyIconScale})`,
            transition: iconTransition,
          }}
          aria-hidden="true"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/25 flex items-center justify-center">
            <Reply size={16} className="text-emerald-400" />
          </div>
        </div>

        {/*
          The bubble is a button, not a div. It carries pointer gestures
          (swipe-reply, double-tap-react, long-press) AND keyboard
          activation: Enter/Space opens the action sheet, which contains
          Reply and the emoji row. That preserves feature parity for
          keyboard-only users without a second UI. Escape is not handled
          here — it falls through to the sheet, which owns dismissal.
        */}
        <button
          type="button"
          onPointerDown={gestures.onPointerDown}
          onPointerMove={gestures.onPointerMove}
          onPointerUp={gestures.onPointerUp}
          onPointerCancel={gestures.onPointerCancel}
          onContextMenu={gestures.onContextMenu}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onLongPress?.(message);
            }
          }}
          aria-label={ariaLabel}
          className={`w-full text-left rounded-2xl px-3 py-2 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${bubbleBgClass}`}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: bubbleTransition,
            touchAction: 'pan-y',
            WebkitTouchCallout: 'none',
            willChange: isSwiping ? 'transform' : undefined,
          }}
        >
          {message.replyToId && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (message.replyToId) onQuoteTap?.(message.replyToId);
              }}
              aria-hidden="true"
            >
              <ReplyPreview
                senderName={replySenderName || 'Message'}
                content={message.replyToContent}
                isDeleted={replyIsDeleted}
                variant="bubble"
              />
            </div>
          )}
          {message.taskRefTitle && (
            <div aria-hidden="true">
              <TaskRefCard
                taskId={message.taskRefId}
                title={message.taskRefTitle}
                date={message.taskRefDate}
                color={message.taskRefColor}
              />
            </div>
          )}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
        </button>
      </div>

      {showReactions && (
        <ReactionRow
          reactions={reactions}
          currentUserId={currentUserId}
          isOutgoing={isOutgoing}
          onToggle={(emoji) => onReact?.(message.id, emoji)}
        />
      )}

      {/* Status / timestamp row */}
      <div
        className="flex items-center gap-1.5 mt-0.5 px-1 text-[10px] text-gray-500 transition-opacity duration-150"
        style={{
          minHeight: `${STATUS_ROW_MIN_HEIGHT_PX}px`,
          opacity: hasRowContent ? 1 : 0,
        }}
        aria-hidden="true"
      >
        {hasRowContent &&
          items.map((node, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-gray-600">·</span>}
              {node}
            </React.Fragment>
          ))}
      </div>
    </div>
  );
};
