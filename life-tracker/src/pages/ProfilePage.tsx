import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, ChevronRight, Camera, AtSign } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { EditNameSheet } from '../components/modals/EditNameSheet';
import { EditDescriptionSheet } from '../components/modals/EditDescriptionSheet';
import { ImagePickerSheet } from '../components/home/views/ImagePickerSheet';
import { SetUsernameSheet } from '../components/modals/SetUsernameSheet';
import { useProfile } from '../hooks/useProfile';
import { useMyProfile } from '../hooks/useMyProfile';
import { useTaskImage } from '../hooks/useTaskImage';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
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
  const { imageUrl } = useTaskImage(profileImageId || undefined);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  const handleBack = () => navigate(-1);

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
            <Avatar
              src={imageUrl || undefined}
              alt={displayName || 'Profile'}
              size="lg"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
          </button>
          <h2 className="text-xl font-bold text-white mt-4">
            {displayName || 'Your Name'}
          </h2>
          {profile?.username && (
            <p className="text-sm text-gray-500 mt-1">@{profile.username}</p>
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
              <span className="text-sm text-white">{displayName || 'Not set'}</span>
              <ChevronRight size={16} className="text-gray-600" />
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
              <ChevronRight size={16} className="text-gray-600" />
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
              <AtSign size={14} className="text-gray-600" />
            </div>
          </button>
        </div>
      </div>

      <EditNameSheet
        isOpen={isEditingName}
        onClose={() => setIsEditingName(false)}
        currentName={displayName}
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
    </div>
  );
};
