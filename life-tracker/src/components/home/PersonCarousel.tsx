import React, { useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import type { CarouselPerson } from '../../hooks/useFriendCarousel';

interface PersonPillProps {
  person: CarouselPerson;
  isActive: boolean;
  onSelect: (personId: string) => void;
}

const PersonPill = React.memo<PersonPillProps>(
  ({ person, isActive, onSelect }) => {
    const pillRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (isActive && pillRef.current) {
        pillRef.current.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, [isActive]);

    return (
      <button
        ref={pillRef}
        type="button"
        onClick={() => onSelect(person.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex-shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-[color,background-color,border-color,transform] active:scale-95 ${
          isActive
            ? 'bg-white border-white'
            : 'bg-[#1E1E1E] border-[#333333] hover:bg-[#252525]'
        }`}
      >
        <DeferredAvatar
          fileId={person.avatarFileId || undefined}
          eager={isActive}
          alt={person.displayName}
          size="sm"
        />
        <span
          className={`text-xs font-medium whitespace-nowrap ${
            isActive ? 'text-black' : 'text-gray-400'
          }`}
        >
          {person.kind === 'me' ? 'Me' : person.displayName}
        </span>
      </button>
    );
  }
);
PersonPill.displayName = 'PersonPill';

interface PersonCarouselProps {
  persons: CarouselPerson[];
  activePersonId: string;
  onSelect: (personId: string) => void;
  onOpenSettings: () => void;
}

const PersonCarouselComponent: React.FC<PersonCarouselProps> = ({
  persons,
  activePersonId,
  onSelect,
  onOpenSettings,
}) => {
  return (
    <div className="bg-[#111111] px-3 py-1.5">
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
        style={{ scrollbarWidth: 'none' }}
      >
        {persons.map((p) => (
          <PersonPill
            key={p.id}
            person={p}
            isActive={p.id === activePersonId}
            onSelect={onSelect}
          />
        ))}
        <button
          type="button"
          onClick={onOpenSettings}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#252525] transition-[color,background-color,transform] active:scale-95"
          aria-label="Friend preferences"
        >
          <Users size={14} />
        </button>
      </div>
    </div>
  );
};

export const PersonCarousel = React.memo(PersonCarouselComponent);
PersonCarousel.displayName = 'PersonCarousel';
