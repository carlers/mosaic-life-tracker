import React from 'react';
import { Copy, Reply, Trash2, Plus } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import type { MessageDocument } from '../../db/schema';

interface MessageActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  message: MessageDocument | null;
  isOwn: boolean;
  currentUserId: string;
  onReply: () => void;
  onCopy: () => void;
  onUnsend: () => void;
  onReact: (emoji: string) => void;
  onMoreEmoji: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  isOpen,
  onClose,
  message,
  isOwn,
  onReply,
  onCopy,
  onUnsend,
  onReact,
  onMoreEmoji,
}) => {
  if (!message) return null;

  const hasContent = message.content.trim().length > 0;
  const hasTaskRef = message.taskRefTitle.trim().length > 0;
  const canCopy = hasContent || hasTaskRef;
  const isUnsent = message.isUnsent;

  if (isUnsent) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Message"
        height="auto"
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-sm text-gray-400 text-center italic">
            This message has been deleted.
          </p>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Message"
      height="auto"
    >
      <div className="pt-2 pb-8 px-1">
        <div className="flex items-center justify-center gap-1.5 mb-4 px-2">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-11 h-11 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#252525] flex items-center justify-center text-xl transition-colors"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => {
              onMoreEmoji();
              onClose();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-11 h-11 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#252525] flex items-center justify-center text-gray-400 transition-colors"
            aria-label="More reactions"
          >
            <Plus size={18} />
          </button>
        </div>

        <button
          onClick={() => {
            onReply();
            onClose();
          }}
          className="w-full flex items-center gap-4 px-3 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white"
        >
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0">
            <Reply size={16} className="text-black" />
          </div>
          <span className="text-base font-medium">Reply</span>
        </button>

        {canCopy && (
          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="w-full flex items-center gap-4 px-3 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white"
          >
            <div className="w-8 h-8 rounded-full bg-purple-400 flex items-center justify-center flex-shrink-0">
              <Copy size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Copy</span>
          </button>
        )}

        {isOwn && (
          <button
            onClick={() => {
              onUnsend();
              onClose();
            }}
            className="w-full flex items-center gap-4 px-3 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-red-400"
          >
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <Trash2 size={16} className="text-white" />
            </div>
            <span className="text-base font-medium">Unsend</span>
          </button>
        )}
      </div>
    </BottomSheet>
  );
};