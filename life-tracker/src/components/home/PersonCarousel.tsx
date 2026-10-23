import React, { useCallback, useEffect, useRef, type Ref } from 'react';
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
        pillRef.current.scrollIntoView?.({
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
        data-person-pill={person.id}
        aria-pressed={isActive}
        tabIndex={isActive ? 0 : -1}
        onClick={() => onSelect(person.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`mosaic-person-pill focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 flex-shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-[color,background-color,border-color,transform] active:scale-95 ${
          isActive
            ? 'mosaic-person-active bg-white border-white'
            : 'mosaic-person-inactive bg-[#1E1E1E] border-[#333333] hover:bg-[#252525]'
        }`}
      >
        <DeferredAvatar
          fileId={person.avatarFileId || undefined}
          eager={isActive}
          alt={person.displayName}
          size="sm"
        />
        <span
          className={`mosaic-person-label text-xs font-medium whitespace-nowrap ${
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
  focusRootRef?: Ref<HTMLDivElement>;
}

const PersonCarouselComponent: React.FC<PersonCarouselProps> = ({
  persons,
  activePersonId,
  onSelect,
  onOpenSettings,
  focusRootRef,
}) => {
  const onPillKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.nativeEvent.isComposing) return;
    if (!(event.target instanceof HTMLButtonElement) || !event.target.dataset.personPill) return;
    const pills = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-person-pill]'));
    const index = pills.indexOf(event.target);
    const destination = event.key === 'ArrowRight' ? index + 1 :
      event.key === 'ArrowLeft' ? index - 1 :
      event.key === 'Home' ? 0 : event.key === 'End' ? pills.length - 1 : -1;
    if (index < 0 || destination < 0 || destination >= pills.length) return;
    event.preventDefault();
    event.stopPropagation();
    const next = pills[destination];
    next.focus({ preventScroll: true });
    const lane = event.currentTarget;
    const laneRect = lane.getBoundingClientRect();
    const rect = next.getBoundingClientRect();
    if (rect.left < laneRect.left) lane.scrollLeft += rect.left - laneRect.left;
    else if (rect.right > laneRect.right) lane.scrollLeft += rect.right - laneRect.right;
  }, []);

  return (
    <div ref={focusRootRef} aria-label="Friends carousel" className="bg-[#111111] px-3 py-1.5">
      <div
        onKeyDown={onPillKeyDown}
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
          className="mosaic-action-icon flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#252525] transition-[color,background-color,transform] active:scale-95"
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
