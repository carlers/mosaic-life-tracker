import React from 'react';
import { Copy, Reply, Trash2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import type { MessageDocument } from '../../db/schema';

interface MessageActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  message: MessageDocument | null;
  isOwn: boolean;
  onReply: () => void;
  onCopy: () => void;
  onUnsend: () => void;
}

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  isOpen,
  onClose,
  message,
  isOwn,
  onReply,
  onCopy,
  onUnsend,
}) => {
  if (!message) return null;

  const hasContent = message.content.trim().length > 0;
  const isUnsent = message.isUnsent;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Message"
      height="auto"
    >
      <div className="pt-2 pb-8 px-1">
        {!isUnsent && (
          <>
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
            {hasContent && (
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
          </>
        )}
        {isOwn && !isUnsent && (
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