import React, { useRef, useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Input } from '../ui/Input';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';
import { useAuth } from '../../hooks/useAuth';

interface ChangeEmailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentEmail: string;
}

export const ChangeEmailSheet: React.FC<ChangeEmailSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentEmail,
}) => {
  const { updateEmail, error } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useSheetReset(isOpen, () => {
    setNewEmail('');
    setPassword('');
    setIsLoading(false);
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => emailInputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!newEmail.trim() || !password.trim()) return;
    setIsLoading(true);
    const success = await updateEmail(newEmail.trim(), password);
    setIsLoading(false);
    if (success) {
      onSuccess();
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Change Email" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <div className="bg-[#111111] rounded-xl p-3 mb-2 border border-[#333333]">
          <p className="text-xs text-gray-500 mb-1">Current Email</p>
          <p className="text-sm text-white font-medium break-all">{currentEmail}</p>
        </div>

        <SheetErrorBanner message={error} />

        <Input
          ref={emailInputRef}
          label="New Email Address"
          type="email"
          placeholder="new@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          autoComplete="email"
        />

        <div className="w-full">
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">Current Password</label>
          <div className="relative">
            <input
              ref={passwordInputRef}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <SheetSaveButton
          onClick={handleSave}
          disabled={!newEmail.trim() || !password.trim()}
          isSaving={isLoading}
          label="Update Email"
        />
      </div>
    </BottomSheet>
  );
};
