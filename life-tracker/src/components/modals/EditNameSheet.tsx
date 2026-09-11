import React, { useState, useRef, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Save } from 'lucide-react';

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

  const [syncedIsOpen, setSyncedIsOpen] = useState(false);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setName(currentName);
    }
  }

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
        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={18} />
              Save Name
            </>
          )}
        </Button>
      </div>
    </BottomSheet>
  );
};