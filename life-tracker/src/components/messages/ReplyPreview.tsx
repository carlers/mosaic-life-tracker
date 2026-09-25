import React from 'react';
import { X, Ban } from 'lucide-react';

interface ReplyPreviewProps {
  senderName: string;
  content: string;
  isDeleted?: boolean;
  onCancel?: () => void;
  variant?: 'composer' | 'bubble';
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  senderName,
  content,
  isDeleted = false,
  onCancel,
  variant = 'composer',
}) => {
  const isComposer = variant === 'composer';
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border-l-2 border-emerald-500 bg-black/30 px-2 py-1.5 ${
        isComposer ? 'mb-2' : 'mb-1.5'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-emerald-400 truncate">
          {senderName}
        </p>
        {isDeleted ? (
          <p className="text-[11px] italic text-gray-400 line-clamp-2 leading-snug flex items-center gap-1">
            <Ban size={9} aria-hidden="true" />
            Message deleted
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 line-clamp-2 leading-snug">
            {content}
          </p>
        )}
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 p-0.5 text-gray-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded"
          aria-label="Cancel reply"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
