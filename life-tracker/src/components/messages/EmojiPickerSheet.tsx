import React, { lazy, Suspense } from 'react';
import type { EmojiClickData, Theme } from 'emoji-picker-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Spinner } from '../ui/Spinner';

const EmojiPicker = lazy(() =>
  import('emoji-picker-react').then(({ default: Picker }) => ({ default: Picker }))
);

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
          <Suspense
            fallback={
              <div className="h-[400px] flex items-center justify-center">
                <Spinner size="w-8 h-8" />
              </div>
            }
          >
            <EmojiPicker
              theme={'dark' as Theme}
              onEmojiClick={handlePick}
              height={400}
              width="100%"
              searchDisabled={false}
              skinTonesDisabled={false}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
            />
          </Suspense>
        </div>
      </div>
    </BottomSheet>
  );
};
