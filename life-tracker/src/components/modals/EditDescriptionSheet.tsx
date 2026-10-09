import React, { useRef, useEffect, useId, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';
import { useSheetSaveAction } from '../../hooks/useSheetSaveAction';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';

interface EditDescriptionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentDescription: string;
  onSave: (description: string) => void | Promise<void>;
}

export const EditDescriptionSheet: React.FC<EditDescriptionSheetProps> = ({
  isOpen,
  onClose,
  currentDescription,
  onSave,
}) => {
  const [description, setDescription] = useState('');
  const { save, reset, isSaving, error } = useSheetSaveAction();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();

  useSheetReset(isOpen, () => {
    setDescription(currentDescription);
    reset();
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    await save(() => onSave(description.trim()), onClose);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} preventDismiss={isSaving} title="Edit Description" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <SheetErrorBanner message={error} />
        <div className="w-full">
          <label htmlFor={textareaId} className="block text-xs text-gray-400 mb-1.5 ml-1">Bio / Description</label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us about yourself..."
            maxLength={200}
            className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400 resize-none min-h-[120px]"
            onPointerDown={(e) => e.stopPropagation()}
          />
          <p className="text-right text-xs text-gray-400 mt-1">{description.length}/200</p>
        </div>
        <SheetSaveButton
          onClick={handleSave}
          isSaving={isSaving}
          label="Save Description"
        />
      </div>
    </BottomSheet>
  );
};
