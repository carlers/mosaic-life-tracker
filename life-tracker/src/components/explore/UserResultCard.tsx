import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Clock, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useTaskImage } from '../../hooks/useTaskImage';
import type { ProfileCard } from '../../lib/social';

interface UserResultCardProps {
  profile: ProfileCard;
  relationship: 'none' | 'outgoing' | 'incoming' | 'friends' | 'self';
  onAdd: (profile: ProfileCard) => void;
  isSending?: boolean;
}

export const UserResultCard: React.FC<UserResultCardProps> = ({
  profile,
  relationship,
  onAdd,
  isSending = false,
}) => {
  const { imageUrl } = useTaskImage(profile.avatar_file_id || undefined);

  const renderAction = () => {
    switch (relationship) {
      case 'self':
        return (
          <span className="text-xs text-gray-500 font-medium px-3 py-1.5">
            This is you
          </span>
        );
      case 'friends':
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-3 py-1.5">
            <Check size={12} strokeWidth={3} />
            Friends
          </span>
        );
      case 'outgoing':
        return (
          <span className="flex items-center gap-1 text-xs text-gray-400 font-medium px-3 py-1.5">
            <Clock size={12} />
            Pending
          </span>
        );
      case 'incoming':
        return (
          <span className="text-xs text-blue-400 font-medium px-3 py-1.5">
            Respond in requests
          </span>
        );
      case 'none':
      default:
        return (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onAdd(profile)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isSending}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <UserPlus size={12} />
            {isSending ? 'Sending…' : 'Add'}
          </motion.button>
        );
    }
  };

  return (
    <div className="flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3">
      <Avatar
        src={imageUrl || undefined}
        alt={profile.display_name || profile.username}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {profile.display_name || profile.username}
        </p>
        <p className="text-xs text-gray-500 truncate">@{profile.username}</p>
      </div>
      {renderAction()}
    </div>
  );
};