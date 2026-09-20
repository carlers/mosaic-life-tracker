import React, { useRef, useState, useEffect } from 'react';
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

function buildBubbleLabel(
  message: MessageDocument,
  isOutgoing: boolean,
  senderName: string,
  replySenderName: string
): string {
  if (message.isUnsent) {
    return isOutgoing ? 'You unsent a message' : `${senderName} unsent a message`;
  }
  const parts: string[] = [];
  if (isOutgoing) {
    parts.push('You said');
  } else {
    parts.push(`${senderName} said`);
  }
  if (message.replyToId) {
    parts.push(`in reply to ${replySenderName}`);
  }
  parts.push(message.content);
  return parts.join(' ');
}

interface StatusRowProps {
  statusKind?: MessageStatusKind;
  showTimestamp?: boolean;
  readAt: string;
  createdAt: string;
}

const StatusRow: React.FC<StatusRowProps> = ({
  statusKind,
  showTimestamp,
  readAt,
  createdAt,
}) => {
  return (
    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/60 min-h-[14px]">
      {statusKind === 'read' ? (
        <>
          <CheckCheck size={12} />
          <span>Seen at {format(new Date(readAt), 'h:mm a')}</span>
        </>
      ) : statusKind === 'delivered' ? (
        <>
          <CheckCheck size={12} />
          <span>Delivered</span>
        </>
      ) : statusKind === 'pending' ? (
        <>
          <Check size={12} />
          <span>Sending</span>
        </>
      ) : showTimestamp ? (
        <span>{format(new Date(createdAt), 'h:mm a')}</span>
      ) : null}
    </div>
  );
};

interface UnsentBubbleProps {
  isOutgoing: boolean;
}

const UnsentBubble: React.FC<UnsentBubbleProps> = ({ isOutgoing }) => {
  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[75%]">
        <div className="block w-full text-left rounded-2xl px-3 py-2 bg-[#2A2A2A] text-gray-400">
          <span className="italic text-gray-400 text-sm">Message deleted</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500 min-h-[14px]">
          <Ban size={12} />
          <span>Unsent</span>
        </div>
      </div>
    </div>
  );
};

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  currentUserId,
  showTimestamp,
  statusKind,
  resolveSenderName,
  onLongPress,
  onQuoteTap,
  onReact,
  onSwipeReply,
  gesturesDisabled,
}) => {
  const [showTimestampLocal, setShowTimestampLocal] = useState(false);
  const senderName = resolveSenderName?.(message.senderId) ?? 'Friend';
  const replySenderName = message.replyToSenderId
    ? resolveSenderName?.(message.replyToSenderId) ?? 'Friend'
    : '';

  const reactions = React.useMemo(
    () => parseReactions(message.reactions),
    [message.reactions]
  );

  useEffect(() => {
    if (!showTimestampLocal) return;
    const timer = setTimeout(() => setShowTimestampLocal(false), 3000);
    return () => clearTimeout(timer);
  }, [showTimestampLocal]);

  const bubbleRef = useRef<HTMLDivElement>(null);

  const swipeDirection: SwipeDirection = isOutgoing ? 'left' : 'right';

  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    swipeOffset,
    isSwiping,
  } = useBubbleGestures({
    swipeDirection,
    onSingleTap: () => setShowTimestampLocal((v) => !v),
    onDoubleTap: () => {
      if (message.isUnsent) return;
      onReact?.(message.id, '❤️');
    },
    onLongPress: () => {
      if (message.isUnsent) return;
      onLongPress?.(message);
    },
    onSwipeReply: () => {
      if (message.isUnsent) return;
      onSwipeReply?.(message);
    },
    disabled: gesturesDisabled || message.isUnsent,
  });

  if (message.isUnsent) {
    return <UnsentBubble isOutgoing={isOutgoing} />;
  }

  const statusRow =
    isOutgoing && (statusKind || showTimestamp || showTimestampLocal);

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[75%]" data-message-id={message.id}>
        <div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            [isOutgoing ? 'right' : 'left']: '-32px',
            opacity: isSwiping ? Math.min(Math.abs(swipeOffset) / 60, 1) : 0,
          }}
        >
          <Reply size={18} className="text-gray-500" />
        </div>
        <div
          ref={bubbleRef}
          role="button"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={onContextMenu}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setShowTimestampLocal((visible) => !visible);
          }}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            touchAction: 'pan-y',
          }}
          className={`select-none block w-full text-left rounded-2xl px-3 py-2 ${
            isOutgoing
              ? 'bg-[#2563EB] text-white'
              : 'bg-[#2A2A2A] text-white'
          }`}
          aria-label={buildBubbleLabel(
            message,
            isOutgoing,
            senderName,
            replySenderName
          )}
        >
          {message.replyToId && (
            <button
              onClick={() => onQuoteTap?.(message.replyToId)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`w-full text-left mb-1.5 rounded-lg px-2 py-1 ${
                isOutgoing ? 'bg-[#1E40AF]' : 'bg-[#1A1A1A]'
              }`}
            >
              <ReplyPreview
                senderName={replySenderName}
                content={message.replyToContent}
                variant="bubble"
              />
            </button>
          )}
          {message.taskRefId && (
            <div className="mb-1.5">
              <TaskRefCard
                taskId={message.taskRefId}
                title={message.taskRefTitle}
                date={message.taskRefDate}
                color={message.taskRefColor}
              />
            </div>
          )}
          <span className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </span>
          {reactions.length > 0 && (
            <div className="mt-1">
              <ReactionRow
                reactions={reactions}
                currentUserId={currentUserId}
                isOutgoing={isOutgoing}
                onToggle={(emoji) => onReact?.(message.id, emoji)}
              />
            </div>
          )}
          {statusRow && (
            <StatusRow
              statusKind={statusKind}
              showTimestamp={showTimestampLocal || showTimestamp}
              readAt={message.readAt}
              createdAt={message.createdAt}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const MessageBubble = React.memo(
  MessageBubbleComponent,
  (prev, next) => {
    return (
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.reactions === next.message.reactions &&
      prev.message.readAt === next.message.readAt &&
      prev.message.deliveryStatus === next.message.deliveryStatus &&
      prev.message.isUnsent === next.message.isUnsent &&
      prev.statusKind === next.statusKind &&
      prev.showTimestamp === next.showTimestamp &&
      prev.isOutgoing === next.isOutgoing &&
      prev.gesturesDisabled === next.gesturesDisabled
    );
  }
);
MessageBubble.displayName = 'MessageBubble';
