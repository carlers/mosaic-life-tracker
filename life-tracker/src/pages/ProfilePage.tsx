import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, ChevronRight, Camera, AtSign } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { EditNameSheet } from '../components/modals/EditNameSheet';
import { EditDescriptionSheet } from '../components/modals/EditDescriptionSheet';
import { EditProfileImageSheet } from '../components/modals/EditProfileImageSheet';
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
  const [isNameSheetOpen, setIsNameSheetOpen] = useState(false);
  const [isDescSheetOpen, setIsDescSheetOpen] = useState(false);
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);
  const [isUsernameSheetOpen, setIsUsernameSheetOpen] = useState(false);
  const { imageUrl } = useTaskImage(profileImageId || undefined);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 bg-[#111111]">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333] flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">Profile</h1>
        <button
          onClick={() => {}}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          aria-label="Share"
        >
          <Share2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-8">
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={() => setIsImageSheetOpen(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="relative group"
          >
            <Avatar
              src={imageUrl || undefined}
              alt={displayName || 'Profile'}
              size="lg"
              className="border-4 border-[#1E1E1E]"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={24} className="text-white" />
            </div>
          </button>
          <button
            onClick={() => setIsImageSheetOpen(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-3 text-blue-500 text-sm font-medium hover:underline"
          >
            Profile image
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setIsUsernameSheetOpen(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
          >
            <span className="flex items-center gap-2 text-base text-gray-300">
              <AtSign size={16} className="text-gray-500" />
              Username
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-white">
                {profile?.username ? `@${profile.username}` : 'Not set'}
              </span>
              <ChevronRight size={18} className="text-gray-500" />
            </div>
          </button>

          <button
            onClick={() => setIsNameSheetOpen(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
          >
            <span className="text-base text-gray-300">Name</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-white">
                {displayName || 'Not set'}
              </span>
              <ChevronRight size={18} className="text-gray-500" />
            </div>
          </button>

          <button
            onClick={() => setIsDescSheetOpen(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
          >
            <span className="text-base text-gray-300">Description</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-white text-right max-w-[200px] truncate">
                {description || 'Not set'}
              </span>
              <ChevronRight size={18} className="text-gray-500" />
            </div>
          </button>
        </div>
      </div>

      <EditNameSheet
        isOpen={isNameSheetOpen}
        onClose={() => setIsNameSheetOpen(false)}
        currentName={displayName}
        onSave={updateDisplayName}
      />
      <EditDescriptionSheet
        isOpen={isDescSheetOpen}
        onClose={() => setIsDescSheetOpen(false)}
        currentDescription={description}
        onSave={updateDescription}
      />
      <EditProfileImageSheet
        isOpen={isImageSheetOpen}
        onClose={() => setIsImageSheetOpen(false)}
        currentImageId={profileImageId}
        onSave={updateProfileImage}
        onRemove={removeProfileImage}
      />
      <SetUsernameSheet
        isOpen={isUsernameSheetOpen}
        onClose={() => setIsUsernameSheetOpen(false)}
      />
    </div>
  );
};