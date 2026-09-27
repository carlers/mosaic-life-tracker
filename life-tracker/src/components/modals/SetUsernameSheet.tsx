import React, { useRef, useEffect, useId, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Input } from '../ui/Input';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { SheetSaveButton } from '../ui/SheetSaveButton';
import { useSheetReset } from '../../hooks/useSheetReset';
import { useMyProfile } from '../../hooks/useMyProfile';
import { useAuth } from '../../hooks/useAuth';
import { isOfflineError } from '../../lib/authEvents';

interface SetUsernameSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (username: string) => void;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const SetUsernameSheet: React.FC<SetUsernameSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { profile, createProfile, checkUsername } = useMyProfile();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const usernameId = useId();
  const usernameHelpId = useId();

  useSheetReset(isOpen, () => {
    setUsername(profile?.username || '');
    setDisplayName(profile?.display_name || user?.name || '');
    setError(null);
    setIsSaving(false);
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(trimmed)) {
      setError('Username must be 3–20 characters: a–z, 0–9, underscore.');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter a display name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (!profile || profile.username !== trimmed) {
        const available = await checkUsername(trimmed);
        if (available === null) {
          setError('Could not check. Try again.');
          setIsSaving(false);
          return;
        }
        if (available === false) {
          setError('That username is already taken.');
          setIsSaving(false);
          return;
        }
      }
      const created = await createProfile({
        username: trimmed,
        displayName: displayName.trim(),
        avatarFileId: profile?.avatar_file_id || '',
        bio: profile?.bio || '',
      });
      if (created) {
        onSuccess?.(created.username);
        onClose();
      }
    } catch (err) {
      console.error('[SetUsernameSheet] Save failed:', err);
      const offline =
        isOfflineError(err) ||
        (typeof navigator !== 'undefined' && navigator.onLine === false);
      setError(
        offline
          ? "You're offline. Reconnect to save your profile."
          : 'Could not save. Try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!profile;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Profile' : 'Choose Username'}
      height="auto"
    >
      <div className="pt-2 pb-8 px-4 space-y-4">
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Your username is how friends find and add you. It must be unique.
        </p>
        <SheetErrorBanner message={error} />
        <div className="w-full">
          <label htmlFor={usernameId} className="block text-xs text-gray-400 mb-1.5 ml-1">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              @
            </span>
            <input
              id={usernameId}
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                )
              }
              placeholder="your_handle"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={usernameHelpId}
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg pl-8 pr-4 py-2.5 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
          <p id={usernameHelpId} className="text-xs text-gray-400 mt-1.5 ml-1">
            3–20 characters · a–z, 0–9, underscore
          </p>
        </div>
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your Name"
          maxLength={50}
        />
        <SheetSaveButton
          onClick={handleSave}
          disabled={!username.trim() || !displayName.trim()}
          isSaving={isSaving}
          label={isEditing ? 'Save Profile' : 'Create Profile'}
        />
      </div>
    </BottomSheet>
  );
};
