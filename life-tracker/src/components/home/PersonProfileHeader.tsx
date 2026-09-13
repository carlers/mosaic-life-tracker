import React from 'react';
import { Avatar } from '../ui/Avatar';
import { useTaskImage } from '../../hooks/useTaskImage';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';

interface PersonProfileHeaderProps {
  person: CarouselPerson;
}

export const PersonProfileHeader: React.FC<PersonProfileHeaderProps> = ({
  person,
}) => {
  const { imageUrl } = useTaskImage(person.avatarFileId || undefined);

  return (
    <div className="px-4 py-1.5 flex items-center gap-3">
      <Avatar
        src={imageUrl || undefined}
        alt={person.displayName}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {person.displayName}
        </p>
        {person.username && (
          <p className="text-xs text-gray-500 truncate">
            @{person.username}
          </p>
        )}
        {person.bio && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
            {person.bio}
          </p>
        )}
      </div>
    </div>
  );
};