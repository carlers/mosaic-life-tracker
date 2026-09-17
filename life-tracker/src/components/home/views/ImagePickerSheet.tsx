import React, { useRef, useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { SheetErrorBanner } from '../../ui/SheetErrorBanner';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadImage } from '../../../lib/storage';
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
  /** Title shown in the sheet header. Callers pass a context-specific label. */
  title: string;
  onSave: (fileId: string) => void;
  onRemove: () => void;
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
  title,
  onSave,
  onRemove,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logPrefix = variant === 'profile' ? '[EditProfileImage]' : '[ImagePicker]';

  useSheetReset(isOpen, () => {
    setError('');
    setIsUploading(false);
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const fileId = await uploadImage(file);
      onSave(fileId);
      onClose();
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      console.error(`${logPrefix} Upload failed:`, err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} height="auto">
      <div className="pt-2 pb-8 px-4 space-y-4">
        <p className="text-sm text-gray-400 text-center">
          Images are automatically compressed to 150KB before uploading.
        </p>

        <SheetErrorBanner message={error} />

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            className="w-full gap-2 py-3"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Compressing &amp; Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Choose from Device
              </>
            )}
          </Button>

          <input
            ref={fileInputRef}
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
              disabled={isUploading}
            >
              <X size={18} />
              Remove Current Photo
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
