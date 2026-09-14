import React from 'react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { BottomSheet } from '../ui/BottomSheet';

interface EmojiPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}

export const EmojiPickerSheet: React.FC<EmojiPickerSheetProps> = ({
  isOpen,
  onClose,
  onPick,
}) => {
  const handlePick = (data: EmojiClickData) => {
    onPick(data.emoji);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Pick a reaction"
      height="auto"
    >
      <div className="pt-2 pb-8 px-1">
        <div className="emoji-picker-wrapper flex justify-center">
          <EmojiPicker
            theme={Theme.DARK}
            onEmojiClick={handlePick}
            height={400}
            width="100%"
            searchDisabled={false}
            skinTonesDisabled={false}
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
          />
        </div>
      </div>
    </BottomSheet>
  );
};