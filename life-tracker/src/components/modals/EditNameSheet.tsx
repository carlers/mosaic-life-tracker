import React, { useRef, useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Input } from '../ui/Input';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';

interface EditNameSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (name: string) => void;
}

export const EditNameSheet: React.FC<EditNameSheetProps> = ({
  isOpen,
  onClose,
  currentName,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useSheetReset(isOpen, () => {
    setName(currentName);
    setIsSaving(false);
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await onSave(name.trim());
    setIsSaving(false);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Edit Name" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <Input
          ref={inputRef}
          label="Display Name"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />
        <SheetSaveButton
          onClick={handleSave}
          disabled={!name.trim()}
          isSaving={isSaving}
          label="Save Name"
        />
      </div>
    </BottomSheet>
  );
};
