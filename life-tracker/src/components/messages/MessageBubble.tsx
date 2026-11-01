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
import { activateOnEnterOrSpace } from '../../lib/keyboardActivation';
import type { MessageDocument } from '../../db/schema';
import { packStickerSummary, parsePackStickerMessage } from '../../lib/stickerPacks';
import { PackStickerImage } from './PackStickerImage';
import { giphyStickerSummary, parseGiphyStickerMessage } from '../../lib/giphyStickers';
import { GiphyStickerImage } from './GiphyStickerImage';
// Keep the image viewer/photoswipe code outside text-only chat's initial chunk.
const ChatPhotoAttachment = React.lazy(() => import('./ChatPhotoAttachment').then(m => ({ default: m.ChatPhotoAttachment })));


export type MessageStatusKind = 'pending' | 'delivered' | 'read' | 'not-sent';

interface MessageBubbleProps {
  message: MessageDocument;
  isOutgoing: boolean;
  currentUserId: string;
  autoplayGiphy?: boolean;
  reducedMotion?: boolean;
  showTimestamp?: boolean;
  statusKind?: MessageStatusKind;
  onRetrySend?: (messageId: string) => void;
  resolveSenderName?: (senderId: string) => string;
  onLongPress?: (message: MessageDocument) => void;
  onQuoteTap?: (targetMessageId: string) => void;
  onDiaryRefTap?: (message: MessageDocument) => void;
  diaryReferencePreview?: { date: string; excerpt: string } | null;
  replyPhotoFileId?: string;
  replySourceUnsent?: boolean;
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
  parts.push(message.attachmentType === 'image' ? 'photo' : packStickerSummary(giphyStickerSummary(message.content)));
  if (message.attachmentType === 'image' && message.content !== '[Photo]') parts.push(message.content.replace(/^\[Photo\]\n?/, ''));
  return parts.join(' ');
}

interface StatusRowProps {
  statusKind?: MessageStatusKind;
  onRetrySend?: () => void;
  showTimestamp?: boolean;
  readAt: string;
  createdAt: string;
}

const StatusRow: React.FC<StatusRowProps> = ({
  statusKind,
  onRetrySend,
  showTimestamp,
  readAt,
  createdAt,
}) => {
  return (
    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400 min-h-[14px]">
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
      ) : statusKind === 'not-sent' ? (
        <>
          <Ban size={12} />
          <span role="status">Not sent</span>
          {onRetrySend && (
            <button type="button" aria-label="Retry sending"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onRetrySend(); }}
              className="ml-1 underline underline-offset-2 focus-visible:outline focus-visible:outline-2">
              Retry
            </button>
          )}
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
        <div className="block w-full text-left rounded-2xl px-3 py-2 bg-surfaceHighlight text-gray-400">
          <span className="italic text-gray-400 text-sm">Message deleted</span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 min-h-[14px]">
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
  autoplayGiphy = false,
  reducedMotion = false,
  showTimestamp,
  statusKind,
  onRetrySend,
  resolveSenderName,
  onLongPress,
  onQuoteTap,
  onDiaryRefTap,
  diaryReferencePreview,
  replyPhotoFileId,
  replySourceUnsent,
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
    onContextMenu: onLongPress ? () => onLongPress(message) : undefined,
    onSwipeReply: () => {
      if (message.isUnsent) return;
      onSwipeReply?.(message);
    },
    disabled: gesturesDisabled || message.isUnsent,
  });

  if (message.isUnsent) {
    return <UnsentBubble isOutgoing={isOutgoing} />;
  }

  const packSticker = parsePackStickerMessage(message.content);
  const giphySticker = parseGiphyStickerMessage(message.content);
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
          <Reply size={18} className="text-gray-400" />
        </div>
        <div
          ref={bubbleRef}
          role="button"
          tabIndex={0}
          data-route-swipe-ignore="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={onContextMenu}
          onKeyDown={(event) => {
            activateOnEnterOrSpace(event, () => setShowTimestampLocal((visible) => !visible));
          }}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            touchAction: 'pan-y',
          }}
          className={`select-none block w-full text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
            packSticker || giphySticker
              ? 'bg-transparent px-1 py-1 text-white'
              : isOutgoing
                ? 'bg-surfaceHighlight text-white px-3 py-2'
                : 'bg-mosaicIncoming border border-[#444444] text-white px-3 py-2'
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
                isOutgoing ? 'bg-surface' : 'bg-surfaceHighlight'
              }`}
            >
              <ReplyPreview
                senderName={replySenderName}
                content={message.replyToContent}
                isDeleted={replySourceUnsent}
                photoFileId={replyPhotoFileId}
                photoUserId={currentUserId}
                variant="bubble"
              />
            </button>
          )}
          {message.diaryRefId && diaryReferencePreview ? (
            <button type="button" data-diary-reference={message.diaryRefId}
              onClick={event => { event.stopPropagation(); onDiaryRefTap?.(message); }}
              onPointerDown={event => event.stopPropagation()}
              aria-label={`Open diary entry from ${diaryReferencePreview.date}`}
              className="mb-2 flex w-full min-w-0 flex-col rounded-lg border border-surfaceHighlight bg-surface px-3 py-2 text-left focus-visible:outline focus-visible:outline-2">
              <span className="max-w-full truncate text-xs font-medium text-white">
                {diaryReferencePreview.excerpt}
              </span>
              <span className="mt-1 text-[10px] text-gray-400">Diary · {diaryReferencePreview.date}</span>
            </button>
          ) : message.diaryRefId ? (
            <div className="mb-2 rounded-lg border border-surfaceHighlight bg-surface px-3 py-2 text-xs text-gray-400" role="status">Diary entry unavailable</div>
          ) : null}
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
          {message.attachmentType === 'image' && message.attachmentFileId && (
            <React.Suspense fallback={<span className="text-xs text-gray-400">Loading photo…</span>}>
              <ChatPhotoAttachment fileId={message.attachmentFileId} userId={currentUserId} caption={message.content.replace(/^\[Photo\]\n?/, '')} />
            </React.Suspense>
          )}
          {message.attachmentType === 'image' ? (
            message.content !== '[Photo]' ? <span className="text-sm whitespace-pre-wrap break-words">{message.content.replace(/^\[Photo\]\n?/, '')}</span> : null
          ) : packSticker ? (
            <PackStickerImage sticker={packSticker} />
          ) : giphySticker ? (
            <GiphyStickerImage id={giphySticker.id} label={giphySticker.label}
              autoplay={autoplayGiphy} reducedMotion={reducedMotion} />
          ) : (
            <span className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </span>
          )}
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
              onRetrySend={onRetrySend ? () => onRetrySend(message.id) : undefined}
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
      prev.currentUserId === next.currentUserId &&
      prev.message.content === next.message.content &&
      prev.message.attachmentType === next.message.attachmentType &&
      prev.message.attachmentFileId === next.message.attachmentFileId &&
      // Remote delivery can repair the quoted snapshot independently of the
      // message body; the thumbnail must update after that sync.
      prev.message.diaryRefId === next.message.diaryRefId &&
      prev.message.diaryRefOwnerId === next.message.diaryRefOwnerId &&
      prev.message.diaryRefDate === next.message.diaryRefDate &&
      prev.message.diaryRefExcerpt === next.message.diaryRefExcerpt &&
      prev.diaryReferencePreview?.date === next.diaryReferencePreview?.date &&
      prev.diaryReferencePreview?.excerpt === next.diaryReferencePreview?.excerpt &&
      prev.replyPhotoFileId === next.replyPhotoFileId &&
      prev.replySourceUnsent === next.replySourceUnsent &&
      prev.message.replyToId === next.message.replyToId &&
      prev.message.replyToContent === next.message.replyToContent &&
      prev.message.replyToSenderId === next.message.replyToSenderId &&
      prev.message.reactions === next.message.reactions &&
      prev.message.readAt === next.message.readAt &&
      prev.message.deliveryStatus === next.message.deliveryStatus &&
      prev.message.isUnsent === next.message.isUnsent &&
      prev.statusKind === next.statusKind &&
      prev.onRetrySend === next.onRetrySend &&
      prev.showTimestamp === next.showTimestamp &&
      prev.isOutgoing === next.isOutgoing &&
      prev.gesturesDisabled === next.gesturesDisabled &&
      prev.autoplayGiphy === next.autoplayGiphy &&
      prev.reducedMotion === next.reducedMotion
    );
  }
);
MessageBubble.displayName = 'MessageBubble';
