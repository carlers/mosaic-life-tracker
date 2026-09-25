import React, { useRef, useEffect, useId, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';
import { useAuth } from '../../hooks/useAuth';

interface ChangePasswordSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangePasswordSheet: React.FC<ChangePasswordSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updatePassword, error } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const oldPasswordInputRef = useRef<HTMLInputElement>(null);
  const oldPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  useSheetReset(isOpen, () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setIsLoading(false);
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => oldPasswordInputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLocalError(null);
    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('New passwords do not match.');
      return;
    }
    if (!oldPassword.trim()) return;

    setIsLoading(true);
    const success = await updatePassword(newPassword, oldPassword);
    setIsLoading(false);

    if (success) {
      onSuccess();
      onClose();
    }
  };

  const displayError = localError || error;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Change Password" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <SheetErrorBanner message={displayError} />

        <div className="w-full">
          <label htmlFor={oldPasswordId} className="block text-xs text-gray-400 mb-1.5 ml-1">Current Password</label>
          <div className="relative">
            <input
              id={oldPasswordId}
              ref={oldPasswordInputRef}
              type="password"
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="w-full">
          <label htmlFor={newPasswordId} className="block text-xs text-gray-400 mb-1.5 ml-1">New Password</label>
          <div className="relative">
            <input
              id={newPasswordId}
              type="password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="w-full">
          <label htmlFor={confirmPasswordId} className="block text-xs text-gray-400 mb-1.5 ml-1">Confirm New Password</label>
          <div className="relative">
            <input
              id={confirmPasswordId}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <SheetSaveButton
          onClick={handleSave}
          disabled={
            !oldPassword.trim() ||
            !newPassword.trim() ||
            !confirmPassword.trim()
          }
          isSaving={isLoading}
          label="Update Password"
        />
      </div>
    </BottomSheet>
  );
};
