import React, { useEffect, useRef } from 'react';
import { BookOpen, Calendar, Check, Columns3, ListChecks } from 'lucide-react';
import type { ViewType } from './ViewSwitcher';

const views = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'todo', label: 'Todo list', icon: ListChecks },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'review', label: 'Daily Review', icon: Columns3 },
] as const;

interface ViewSwitcherMenuProps {
  activeView: ViewType;
  allowDailyReview: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onChoose: (view: ViewType) => void;
  onClose: () => void;
}

export const ViewSwitcherMenu: React.FC<ViewSwitcherMenuProps> = ({
  activeView, allowDailyReview, rootRef, triggerRef, onChoose, onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const allowed = allowDailyReview ? views : views.filter(view => view.id !== 'review');
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [rootRef, triggerRef, onClose]);

  return <div role="menu" aria-label="Choose Home view" ref={menuRef}
    className="absolute left-0 top-full mt-2 min-w-48 rounded-xl border border-[#444444] bg-surface p-1 shadow-xl">
    {allowed.map(item => {
      const Icon = item.icon;
      return <button type="button" key={item.id} role="menuitemradio" aria-checked={activeView === item.id}
        aria-label={item.label} onClick={() => onChoose(item.id)}
        onPointerDown={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
          const index = items.indexOf(event.currentTarget);
          items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
        }}
        className={'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-surfaceHighlight focus-visible:outline ' +
          (activeView === item.id ? 'bg-surfaceHighlight' : '')}>
        <Icon size={17} aria-hidden="true" /><span className="flex-1 whitespace-nowrap">{item.label}</span>
        {activeView === item.id && <Check size={15} aria-hidden="true" />}
      </button>;
    })}
  </div>;
};
