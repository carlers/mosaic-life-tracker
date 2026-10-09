import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, ChevronRight, Camera, AtSign } from 'lucide-react';
import { DeferredAvatar } from '../components/ui/DeferredAvatar';
import { EditNameSheet } from '../components/modals/EditNameSheet';
import { EditDescriptionSheet } from '../components/modals/EditDescriptionSheet';
import { ImagePickerSheet } from '../components/home/views/ImagePickerSheet';
import { SetUsernameSheet } from '../components/modals/SetUsernameSheet';
import { useProfile } from '../hooks/useProfile';
import { useMyProfile } from '../hooks/useMyProfile';
import { buildProfileShareData, shareProfile } from '../lib/profileShare';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    displayName,
    description,
    profileImageId,
    updateDisplayName,
    updateDescription,
    updateProfileImage,
    removeProfileImage,
  } = useProfile();
  const { profile } = useMyProfile();
  // Settings owns edits; the public profile preserves legacy/signup names until edited.
  const resolvedDisplayName = displayName || profile?.display_name || '';
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const handleBack = () => {
    const parent = '/settings';
    if (hasExpectedRouteParent(location.key, location.state, parent)) {
      navigate(-1);
    } else {
      navigate(parent, { replace: true });
    }
  };
  const handleShare = async () => {
    const result = await shareProfile(buildProfileShareData(
      window.location.origin,
      profile?.username,
      resolvedDisplayName
    ));
    if (result === 'copied') setShareFeedback('Profile invitation copied');
    else if (result === 'unavailable') setShareFeedback('Sharing is not available on this device');
    else return;
    window.setTimeout(() => setShareFeedback(null), 2500);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="sticky top-0 z-20 bg-[#111111] border-b border-[#333333]">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-white flex-1">Profile</h1>
          <button
            type="button"
            onClick={handleShare}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
            aria-label="Share profile"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 py-6">
        <div className="flex flex-col items-center mb-8">
          <button
            onClick={() => setIsEditingImage(true)}
            className="relative group"
            aria-label="Change profile image"
          >
            <DeferredAvatar
              fileId={profileImageId || undefined}
              eager
              alt={resolvedDisplayName || 'Profile'}
              size="lg"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
          </button>
          <h2 className="text-xl font-bold text-white mt-4">
            {resolvedDisplayName || 'Your Name'}
          </h2>
          {profile?.username && (
            <p className="text-sm text-gray-400 mt-1">@{profile.username}</p>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setIsEditingName(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-between p-4 bg-[#1E1E1E] border border-[#333333] rounded-xl hover:bg-[#252525] transition-colors"
          >
            <span className="text-sm text-gray-400">Display Name</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{resolvedDisplayName || 'Not set'}</span>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => setIsEditingDescription(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-between p-4 bg-[#1E1E1E] border border-[#333333] rounded-xl hover:bg-[#252525] transition-colors"
          >
            <span className="text-sm text-gray-400">Bio</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white truncate max-w-[160px]">
                {description || 'Not set'}
              </span>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => setIsEditingUsername(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-between p-4 bg-[#1E1E1E] border border-[#333333] rounded-xl hover:bg-[#252525] transition-colors"
          >
            <span className="text-sm text-gray-400">Username</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">
                {profile?.username ? `@${profile.username}` : 'Not set'}
              </span>
              <AtSign size={14} className="text-gray-400" />
            </div>
          </button>
        </div>
      </div>

      <EditNameSheet
        isOpen={isEditingName}
        onClose={() => setIsEditingName(false)}
        currentName={resolvedDisplayName}
        onSave={updateDisplayName}
      />
      <EditDescriptionSheet
        isOpen={isEditingDescription}
        onClose={() => setIsEditingDescription(false)}
        currentDescription={description}
        onSave={updateDescription}
      />
      <ImagePickerSheet
        isOpen={isEditingImage}
        onClose={() => setIsEditingImage(false)}
        variant="profile"
        hasExistingImage={!!profileImageId}
        title="Profile Image"
        onSave={updateProfileImage}
        onRemove={removeProfileImage}
      />
      <SetUsernameSheet
        isOpen={isEditingUsername}
        onClose={() => setIsEditingUsername(false)}
        onSuccess={() => setIsEditingUsername(false)}
      />
      {shareFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-[#444444] bg-[#2A2A2A] px-5 py-2.5 text-sm text-white shadow-lg"
        >
          {shareFeedback}
        </div>
      )}
    </div>
  );
};
