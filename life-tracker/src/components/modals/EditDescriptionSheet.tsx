import React, { useRef, useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';

interface EditDescriptionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentDescription: string;
  onSave: (description: string) => void;
}

export const EditDescriptionSheet: React.FC<EditDescriptionSheetProps> = ({
  isOpen,
  onClose,
  currentDescription,
  onSave,
}) => {
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useSheetReset(isOpen, () => {
    setDescription(currentDescription);
    setIsSaving(false);
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(description.trim());
    setIsSaving(false);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Edit Description" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <div className="w-full">
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">Bio / Description</label>
          <textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us about yourself..."
            maxLength={200}
            className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600 resize-none min-h-[120px]"
            onPointerDown={(e) => e.stopPropagation()}
          />
          <p className="text-right text-xs text-gray-500 mt-1">{description.length}/200</p>
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
