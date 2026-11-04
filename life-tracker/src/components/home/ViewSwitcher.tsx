import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Calendar, Check, ChevronDown, Columns3, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'review';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  allowDailyReview?: boolean;
}

const views = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'todo', label: 'Todo list', icon: ListChecks },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'review', label: 'Daily Review', icon: Columns3 },
] as const;

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ activeView, onViewChange, allowDailyReview = false }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const allowedViews = allowDailyReview ? views : views.filter(view => view.id !== 'review');
  const active = allowedViews.find(view => view.id === activeView) ?? allowedViews[0];
  const Icon = active.icon;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const choose = (view: ViewType) => {
    onViewChange(view);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div ref={rootRef} className="relative z-30 shrink-0">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open}
      aria-label={'View: ' + active.label} onClick={() => setOpen(current => !current)}
      onPointerDown={event => event.stopPropagation()}
      className="flex h-9 w-10 items-center justify-center gap-0.5 rounded-lg border border-[#333333] bg-surface text-white focus-visible:outline focus-visible:outline-2">
      <Icon size={17} aria-hidden="true" /><ChevronDown size={11} aria-hidden="true" />
    </button>
    <div role="menu" aria-label="Choose Home view" aria-hidden={!open}
      className={'absolute left-0 top-full mt-2 min-w-48 rounded-xl border border-[#444444] bg-surface p-1 shadow-xl ' +
        (open ? 'visible' : 'invisible pointer-events-none')}>
      {allowedViews.map(view => {
        const ItemIcon = view.icon;
        return <button type="button" key={view.id}
          role="menuitemradio" aria-checked={activeView === view.id}
          aria-label={view.label} tabIndex={open ? 0 : -1}
          onClick={() => choose(view.id)} onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
            const index = buttons.indexOf(event.currentTarget);
            buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
          }}
          className={'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-surfaceHighlight focus-visible:outline ' +
            (activeView === view.id ? 'bg-surfaceHighlight' : '')}>
          <ItemIcon size={17} aria-hidden="true" />
          <span className="flex-1 whitespace-nowrap">{view.label}</span>
          {activeView === view.id && <Check size={15} aria-hidden="true" />}
        </button>;
      })}
    </div>
  </div>;
};
