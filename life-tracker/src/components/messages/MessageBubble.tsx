import React from 'react';
import { TaskRefCard } from './TaskRefCard';
import type { MessageDocument } from '../../db/schema';

interface MessageBubbleProps {
  message: MessageDocument;
  isOutgoing: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
}) => {
  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 ${
          isOutgoing
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-[#1E1E1E] text-gray-100 border border-[#333333] rounded-bl-md'
        }`}
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
        {isOutgoing && message.deliveryStatus === 'pending' && (
          <p className="text-[10px] text-white/60 mt-1 text-right">Sending…</p>
        )}
      </div>
    </div>
  );
};