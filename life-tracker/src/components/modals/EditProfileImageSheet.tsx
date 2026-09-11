import React, { useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadImage } from '../../lib/storage';

interface EditProfileImageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentImageId: string;
  onSave: (fileId: string) => void;
  onRemove: () => void;
}

export const EditProfileImageSheet: React.FC<EditProfileImageSheetProps> = ({
  isOpen,
  onClose,
  currentImageId,
  onSave,
  onRemove,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      console.error('[EditProfileImage] Upload failed:', err);
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
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Profile Image" height="auto">
      <div className="pt-2 pb-8 px-4 space-y-4">
        <p className="text-sm text-gray-400 text-center">
          Images are automatically compressed to 150KB before uploading.
        </p>
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
            {error}
          </div>
        )}
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
                Compressing & Uploading...
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
          {currentImageId && (
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