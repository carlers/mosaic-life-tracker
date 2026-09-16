import React, { useState, useRef, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Save } from 'lucide-react';
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
  const [syncedIsOpen, setSyncedIsOpen] = useState(false);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setUsername(profile?.username || '');
      setDisplayName(profile?.display_name || user?.name || '');
      setError(null);
      setIsSaving(false);
    }
  }
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
          // Could not determine: session expired, network drop, or server
          // error. If it was a 401, the global auth redirect is already
          // in flight. Otherwise, let the user retry.
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
      // Distinguish "we couldn't reach the server" from "the save itself
      // failed." The outbox has already queued the write, so the profile
      // will sync once connectivity returns.
      const offline =
        isOfflineError(err) ||
        (typeof navigator !== 'undefined' && navigator.onLine === false);
      setError(
        offline
          ? "You're offline. Your profile will sync when you reconnect."
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
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}
        <div className="w-full">
          <label className="block text-xs text-gray-500 mb-1.5 ml-1">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
              @
            </span>
            <input
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
              className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-lg pl-8 pr-4 py-2.5 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5 ml-1">
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
        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          onClick={handleSave}
          disabled={
            isSaving ||
            !username.trim() ||
            !displayName.trim()
          }
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={18} />
              {isEditing ? 'Save Profile' : 'Create Profile'}
            </>
          )}
        </Button>
      </div>
    </BottomSheet>
  );
};
