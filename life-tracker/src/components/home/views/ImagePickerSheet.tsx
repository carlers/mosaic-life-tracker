import React, { useRef, useState } from 'react';
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
   * `'task'` â€” attached to a task. `hasExistingImage` comes from the
   * task's `image` field. The remove button is shown when the task
   * already has an image.
   *
   * `'profile'` â€” attached to the user profile. `hasExistingImage` is
   * derived from the profile's `profileImageId`. The remove button is
   * shown whenever a profile image exists.
   */
  variant: 'task' | 'profile';
  /** Whether an image is already set; drives the remove-button visibility. */
  hasExistingImage: boolean;
  /** Title shown in the sheet header. Callers pass a context-specific label. */
  title: string;
  onSave: (fileId: string) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}

/**
 * Unified image picker sheet (DUP-7). Replaces the previously separate
 * `ImagePickerSheet` (task-scoped) and `EditProfileImageSheet`
 * (¶»§q«^