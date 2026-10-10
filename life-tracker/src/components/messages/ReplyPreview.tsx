import React from 'react';
import { X, Ban } from 'lucide-react';
import { packStickerSummary, parsePackStickerMessage } from '../../lib/stickerPacks';
import { giphyStickerSummary, parseGiphyStickerMessage } from '../../lib/giphyStickers';
import { PackStickerImage } from './PackStickerImage';
import { GiphyStickerImage } from './GiphyStickerImage';

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
  const packSticker = !isDeleted ? parsePackStickerMessage(content) : null;
  const giphySticker = !isDeleted && !packSticker ? parseGiphyStickerMessage(content) : null;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border-l-2 border-emerald-500 bg-surface px-2 py-1.5 ${
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
        ) : packSticker || giphySticker ? (
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {packSticker ? (
              <PackStickerImage sticker={packSticker} size="reply" />
            ) : giphySticker ? (
              <GiphyStickerImage id={giphySticker.id} label={giphySticker.label} compact />
            ) : null}
            <span className="min-w-0 line-clamp-2 text-[11px] leading-snug text-gray-400">
              {packStickerSummary(giphyStickerSummary(content))}
            </span>
          </div>
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
