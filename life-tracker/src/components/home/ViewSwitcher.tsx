import React, { Suspense, lazy, useRef, useState } from 'react';
import { BookOpen, Calendar, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'review';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  allowDailyReview?: boolean;
}

// Keep the Home header light. The menu is only downloaded on first open.
const ViewSwitcherMenu = lazy(() => import('./ViewSwitcherMenu').then(module => ({
  default: module.ViewSwitcherMenu,
})));

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  activeView, onViewChange, allowDailyReview = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const view = !allowDailyReview && activeView === 'review' ? 'calendar' : activeView;
  const ActiveIcon = view === 'todo' ? ListChecks : view === 'diary' ? BookOpen : Calendar;
  const label = view === 'todo' ? 'Todo list' : view === 'diary' ? 'Diary' :
    view === 'review' ? 'Daily Review' : 'Calendar';
  const choose = (next: ViewType) => {
    setOpen(false);
    onViewChange(next);
    triggerRef.current?.focus();
  };
  return <div ref={rootRef} className="relative z-30 shrink-0">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open}
      aria-label={'View: ' + label} onClick={() => setOpen(current => !current)}
      onPointerDown={event => event.stopPropagation()}
      className="flex h-9 w-10 items-center justify-center rounded-lg border border-[#333333] bg-surface text-white focus-visible:outline focus-visible:outline-2">
      {view === 'review'
        ? <span aria-hidden="true" className="text-xl leading-none">▥</span>
        : <ActiveIcon size={17} aria-hidden="true" />}
    </button>
    {open && <Suspense fallback={null}>
      <ViewSwitcherMenu activeView={view} allowDailyReview={allowDailyReview}
        rootRef={rootRef} triggerRef={triggerRef}
        onClose={() => setOpen(false)} onChoose={choose} />
    </Suspense>}
  </div>;
};
