import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import { TaskRefCard } from './TaskRefCard';
import type { MessageDocument } from '../../db/schema';

export type MessageStatusKind = 'pending' | 'delivered' | 'read';

interface MessageBubbleProps {
  message: MessageDocument;
  isOutgoing: boolean;
  /** Auto-reveal the timestamp (e.g. >5 min gap since previous message). */
  showTimestamp?: boolean;
  /** Render a status row under the bubble: 'pending' | 'delivered' | 'read'. */
  statusKind?: MessageStatusKind;
}

const REVEAL_DURATION_MS = 2500;

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  showTimestamp = false,
  statusKind,
}) => {
  const [hovered, setHovered] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = () => {
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

  // Build the status/timestamp row items
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

  // Don't duplicate the time when the "Seen at" receipt already shows one
  const showMessageTime = timestampVisible && statusKind !== 'read';
  if (showMessageTime) {
    items.push(<span key="time">{timeLabel}</span>);
  }

  const showRow = items.length > 0;

  const bubbleBgClass = isOutgoing
    ? 'bg-emerald-600 text-white rounded-br-md'
    : 'bg-[#1E1E1E] text-gray-100 border border-[#333333] rounded-bl-md';

  return (
    <div
      className={`flex flex-col ${
        isOutgoing ? 'items-end' : 'items-start'
      } mb-1`}
    >
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`max-w-[78%] rounded-2xl px-3 py-2 cursor-pointer select-none ${bubbleBgClass}`}
      >
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