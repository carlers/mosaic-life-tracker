import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Ban } from 'lucide-react';
import { TaskRefCard } from './TaskRefCard';
import { ReplyPreview } from './ReplyPreview';
import { useLongPress } from '../../hooks/useLongPress';
import type { MessageDocument } from '../../db/schema';

export type MessageStatusKind = 'pending' | 'delivered' | 'read';

interface MessageBubbleProps {
  message: MessageDocument;
  isOutgoing: boolean;
  showTimestamp?: boolean;
  statusKind?: MessageStatusKind;
  resolveSenderName?: (senderId: string) => string;
  onLongPress?: (message: MessageDocument) => void;
  onQuoteTap?: (targetMessageId: string) => void;
}

const REVEAL_DURATION_MS = 2500;

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  showTimestamp = false,
  statusKind,
  resolveSenderName,
  onLongPress,
  onQuoteTap,
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

  const longPress = useLongPress(
    () => {
      if (!isUnsent) onLongPress?.(message);
    },
    { threshold: 500 }
  );

  const handleClick = () => {
    if (longPress.consumeDidFire()) return;
    if (isUnsent) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRevealed(true);
    timeoutRef.current = setTimeout(
      () => setRevealed(false),
      REVEAL_DURATION_MS
    );
  };

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
  const showRow = items.length > 0;

  const replySenderName =
    message.replyToSenderId && resolveSenderName
      ? resolveSenderName(message.replyToSenderId)
      : '';

  // A quote is a tombstone when it has a link but the content was wiped.
  const replyIsDeleted =
    !!message.replyToId && message.replyToContent.length === 0;

  const bubbleBgClass = isOutgoing
    ? 'bg-emerald-600 text-white rounded-br-md'
    : 'bg-[#1E1E1E] text-gray-100 border border-[#333333] rounded-bl-md';

  // Unsent rendering: no quote, no task-ref, no content, italic tombstone.
  if (isUnsent) {
    return (
      <div
        data-message-id={message.id}
        className={`flex flex-col ${
          isOutgoing ? 'items-end' : 'items-start'
        } mb-1`}
      >
        <div
          className={`max-w-[78%] rounded-2xl px-3 py-2 ${
            isOutgoing
              ? 'bg-emerald-600/40 rounded-br-md'
              : 'bg-[#1E1E1E]/60 border border-[#333333] rounded-bl-md'
          }`}
        >
          <p className="text-sm italic text-gray-300 flex items-center gap-1.5">
            <Ban size={12} />
            Message deleted
          </p>
        </div>
        {showRow && (
          <div className="flex items-center gap-1.5 mt-0.5 px-1 text-[10px] text-gray-500">
            {items.map((node, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-600">·</span>}
                {node}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-message-id={message.id}
      className={`flex flex-col ${
        isOutgoing ? 'items-end' : 'items-start'
      } mb-1`}
    >
      <div
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerLeave={longPress.onPointerLeave}
        onPointerCancel={longPress.onPointerCancel}
        onContextMenu={longPress.onContextMenu}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`max-w-[78%] rounded-2xl px-3 py-2 cursor-pointer select-none ${bubbleBgClass}`}
        style={{ WebkitTouchCallout: 'none' }}
      >
        {message.replyToId && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (message.replyToId) onQuoteTap?.(message.replyToId);
            }}
            className="cursor-pointer"
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
          <TaskRefCard
            taskId={message.taskRefId}
            title={message.taskRefTitle}
            date={message.taskRefDate}
            color={message.taskRefColor}
          />
        )}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
      </div>
      {showRow && (
        <div className="flex items-center gap-1.5 mt-0.5 px-1 text-[10px] text-gray-500">
          {items.map((node, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-gray-600">·</span>}
              {node}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};