import React, { useRef, useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Input } from '../ui/Input';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';
import { useSheetSaveAction } from '../../hooks/useSheetSaveAction';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';

interface EditNameSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (name: string) => void | Promise<void>;
}

export const EditNameSheet: React.FC<EditNameSheetProps> = ({
  isOpen,
  onClose,
  currentName,
  onSave,
}) => {
  const [name, setName] = useState('');
  const { save, reset, isSaving, error } = useSheetSaveAction();
  const inputRef = useRef<HTMLInputElement>(null);

  useSheetReset(isOpen, () => {
    setName(currentName);
    reset();
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await save(() => onSave(name.trim()), onClose);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} preventDismiss={isSaving} title="Edit Name" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <SheetErrorBanner message={error} />
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
