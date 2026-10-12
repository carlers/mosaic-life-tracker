import React from 'react';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';

interface PersonProfileHeaderProps {
  person: CarouselPerson;
  isActive: boolean;
  onDiaryToday?: () => void;
}

export const PersonProfileHeader: React.FC<PersonProfileHeaderProps> = ({
  person,
  isActive,
  onDiaryToday,
}) => {
  return (
    <div className="px-4 py-1.5 flex items-center gap-3">
      <DeferredAvatar
        fileId={person.avatarFileId || undefined}
        eager={isActive}
        alt={person.displayName}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {person.displayName}
        </p>
        {person.username && (
          <p className="text-xs text-gray-400 truncate">
            @{person.username}
          </p>
        )}
        {person.bio && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
            {person.bio}
          </p>
        )}
      </div>
      {onDiaryToday && (
        <button type="button" onClick={onDiaryToday} aria-label="Open today's diary"
          className="rounded-full p-2 text-xl hover:bg-surfaceHighlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">📝</button>
      )}
    </div>
  );
};
