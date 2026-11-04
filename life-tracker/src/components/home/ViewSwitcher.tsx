import React, { useState } from 'react';
import { BookOpen, Calendar, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'review';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  allowDailyReview?: boolean;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  activeView, onViewChange, allowDailyReview = false,
}) => {
  const [Picker, setPicker] = useState<React.ComponentType<Required<ViewSwitcherProps>> | null>(null);
  const current = !allowDailyReview && activeView === 'review' ? 'calendar' : activeView;
  const Icon = current === 'todo' ? ListChecks : current === 'diary' ? BookOpen : Calendar;
  if (Picker) return <div className="relative shrink-0">
    <Picker activeView={current} onViewChange={onViewChange} allowDailyReview={allowDailyReview} />
  </div>;
  return <button type="button" aria-label="Choose Home view"
    className="flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-[#333333] bg-surface text-white focus-visible:outline"
    onPointerDown={event => event.stopPropagation()}
    onClick={() => {
      void import('./MosaicHomeViewPicker')
        .then(module => setPicker(() => module.MosaicHomeViewPicker))
        .catch(() => { /* Retain retryable icon trigger on an unavailable chunk. */ });
    }}>
    {current === 'review' ? <span aria-hidden="true">▥</span> : <Icon size={17} aria-hidden="true" />}
  </button>;
};
