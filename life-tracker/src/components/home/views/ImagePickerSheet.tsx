import React, { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { SheetErrorBanner } from '../../ui/SheetErrorBanner';
import { Upload, X, Loader2 } from 'lucide-react';
import { saveTaskImage, saveProfileImage } from '../../../lib/storage';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../../../lib/featureControls';
import { useAuth } from '../../../hooks/useAuth';
import { useSheetReset } from '../../../hooks/useSheetReset';

interface ImagePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * `'task'` — attached to a task. `hasExistingImage` comes from the
   * task's `image` field. The remove button is shown when the task
   * already has an image.
   *
   * `'profile'` — attached to the user profile. `hasExistingImage` is
   * derived from the profile's `profileImageId`. The remove button is
   * shown whenever a profile image exists.
   */
  variant: 'task' | 'profile';
  /** Whether an image is already set; drives the remove-button visibility. */
  hasExistingImage: boolean;
  /** Expected current task photo before the upload starts. */
  existingFileId?: string;
  /** Title shown in the sheet header. Callers pass a context-specific label. */
  title: string;
  onSave: (fileId: string, expectedImageId: string) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}

/**
 * Unified image picker sheet (DUP-7). Replaces the previously separate
 * `ImagePickerSheet` (task-scoped) and `EditProfileImageSheet`
 * (profile-scoped). The two differed only in title, the log prefix, and
 * how "is there an existing image to remove" was derived — all of which
 * the caller now supplies.
 */
export const ImagePickerSheet: React.FC<ImagePickerSheetProps> = ({
  isOpen,
  onClose,
  variant,
  hasExistingImage,
  existingFileId = '',
  title,
  onSave,
  onRemove,
}) => {
  const { user } = useAuth();
  const taskPhotoUploadEnabled = useFeatureEnabled('mosaic_disable_task_photo_upload');
  const profilePhotoUploadEnabled = useFeatureEnabled('mosaic_disable_profile_photo_upload');
  const canUpload = variant === 'profile' ? profilePhotoUploadEnabled : taskPhotoUploadEnabled;
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPendingRef = useRef(false);
  const removePendingRef = useRef(false);
  const activeOwnerRef = useRef(user?.$id);
  const mountedRef = useRef(true);
  useEffect(() => {
    activeOwnerRef.current = user?.$id;
  }, [user?.$id]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const logPrefix = variant === 'profile' ? '[EditProfileImage]' : '[ImagePicker]';

  const safeUploadError = (cause: unknown): string => {
    const error = cause as { name?: string; message?: string; code?: number; cause?: unknown };
    const source = (error?.cause ?? error) as { name?: string; code?: number };
    const message = error?.message ?? '';
    if (/Task photo changed|Task is no longer|Task no longer belongs/i.test(message)) {
      return 'Task changed while saving. Reopen it before trying again.';
    }
    if (/Account changed/i.test(message)) return 'Account changed. Reopen the photo picker.';
    if (source?.code === 401) return 'Sign in again before adding a photo.';
    if (source?.code === 403) return 'Photo upload is not permitted for this account.';
    if (source?.name === 'QuotaExceededError' || /IndexedDB|pending photo storage|storage was aborted/i.test(message)) {
      return 'Device photo storage is unavailable or full. Free up space and retry.';
    }
    if (/compress|unsupported image|decode/i.test(message)) {
      return 'This photo could not be processed. Try a JPG, PNG, or WebP photo.';
    }
    return 'Photo could not be saved. Check your connection or try again.';
  };

  useSheetReset(isOpen, () => {
    if (uploadPendingRef.current || removePendingRef.current) return;
    setError('');
    setIsUploading(false);
    setIsRemoving(false);
  });
  const handleClose = () => {
    if (!uploadPendingRef.current && !removePendingRef.current) onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadPendingRef.current || isUploading || isRemoving || removePendingRef.current) return;
    if (!isFeatureEnabled(variant === 'profile' ? 'mosaic_disable_profile_photo_upload' : 'mosaic_disable_task_photo_upload')) {
      setError(variant === 'profile'
        ? 'New profile photo uploads are currently unavailable.'
        : 'Task photo uploads are currently unavailable.');
      return;
    }
    uploadPendingRef.current = true;
    setIsUploading(true);
    setError('');
    const expectedImageId = existingFileId;
    try {
      const userId = user?.$id;
      if (!userId) throw new Error('Not authenticated');
      const fileId = await (variant === 'profile' ? saveProfileImage(file, userId) : saveTaskImage(file, userId));
      if (!mountedRef.current || activeOwnerRef.current !== userId) {
        throw new Error('Account changed while saving photo');
      }
      await onSave(fileId, expectedImageId);
      onClose();
    } catch (err) {
      if (mountedRef.current) setError(safeUploadError(err));
      console.error(`${logPrefix} Upload failed:`, err);
    } finally {
      uploadPendingRef.current = false;
      if (mountedRef.current) setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (removePendingRef.current || uploadPendingRef.current || isRemoving || isUploading) return;
    removePendingRef.current = true;
    setIsRemoving(true);
    setError('');
    try {
      await onRemove();
      onClose();
    } catch (err) {
      setError('Failed to remove image. Please try again.');
      console.error(logPrefix + ' Remove failed:', err);
    } finally {
      removePendingRef.current = false;
      setIsRemoving(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} preventDismiss={isUploading || isRemoving} title={title} height="auto">
      <div className="pt-2 pb-8 px-4 space-y-4">
        <p className="text-sm text-gray-400 text-center">
          {canUpload
            ? 'Images are compressed on-device and sync automatically when online.'
            : 'New photo uploads are currently unavailable. Existing photos are preserved.'}
        </p>

        <SheetErrorBanner message={error} />

        <div className="flex flex-col gap-3">
          {canUpload && <Button
            variant="primary"
            className="w-full gap-2 py-3"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isRemoving}
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving photo...
              </>
            ) : (
              <>
                <Upload size={18} />
                Choose from Device
              </>
            )}
          </Button>}

          <input
            ref={fileInputRef}
            disabled={isUploading || isRemoving}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {hasExistingImage && (
            <Button
              variant="danger"
              className="w-full gap-2 py-3"
              onClick={handleRemove}
              disabled={isUploading || isRemoving}
            >
              {isRemoving ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
              {isRemoving ? 'Removing photo...' : 'Remove Current Photo'}
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
