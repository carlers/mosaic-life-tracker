import React, { Suspense, lazy, useState } from 'react';
import { BookOpen, Calendar, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'review';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  allowDailyReview?: boolean;
}

const MosaicHomeViewPicker = lazy(() => import('./MosaicHomeViewPicker').then(module => ({
  default: module.MosaicHomeViewPicker,
})));

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  activeView, onViewChange, allowDailyReview = false,
}) => {
  const [activated, setActivated] = useState(false);
  const current = !allowDailyReview && activeView === 'review' ? 'calendar' : activeView;
  const Icon = current === 'todo' ? ListChecks : current === 'diary' ? BookOpen : Calendar;
  const fallback = <button type="button" aria-label="Choose Home view"
    className="flex h-9 w-10 items-center justify-center rounded-lg border border-[#333333] bg-surface text-white focus-visible:outline"
    onPointerDown={event => event.stopPropagation()}
    onClick={() => setActivated(true)}>
    {current === 'review' ? <span aria-hidden="true">▥</span> : <Icon size={17} aria-hidden="true" />}
  </button>;
  return <div className="relative shrink-0">
    {activated
      ? <Suspense fallback={fallback}>
          <MosaicHomeViewPicker activeView={current} onViewChange={onViewChange}
            allowDailyReview={allowDailyReview} />
        </Suspense>
      : fallback}
  </div>;
};
