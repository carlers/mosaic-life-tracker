import React, { useState, useRef, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Save } from 'lucide-react';
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

  // Render-body reset pattern (React 18/19 compliant, prevents cascading renders)
  const [syncedIsOpen, setSyncedIsOpen] = useState(false);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLocalError(null);
    }
  }

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
        {displayError && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
            {displayError}
          </div>
        )}

        <div className="w-full">
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">Current Password</label>
          <div className="relative">
            <input
              ref={oldPasswordInputRef}
              type="password"
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="w-full">
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">New Password</label>
          <div className="relative">
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="w-full">
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">Confirm New Password</label>
          <div className="relative">
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg px-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          onClick={handleSave}
          disabled={!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim() || isLoading}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={18} />
              Update Password
            </>
          )}
        </Button>
      </div>
    </BottomSheet>
  );
};