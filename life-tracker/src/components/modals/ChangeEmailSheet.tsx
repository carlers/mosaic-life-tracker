import React, { useState, useRef, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Save } from 'lucide-react';
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

  // Render-body reset pattern (React 18/19 compliant, prevents cascading renders)
  const [syncedIsOpen, setSyncedIsOpen] = useState(false);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setNewEmail('');
      setPassword('');
    }
  }

  useEffect(() => {
    if (isOpen) {
      // Focus email input after sheet animation (DOM manipulation is valid in useEffect)
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

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}

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

        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          onClick={handleSave}
          disabled={!newEmail.trim() || !password.trim() || isLoading}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={18} />
              Update Email
            </>
          )}
        </Button>
      </div>
    </BottomSheet>
  );
};