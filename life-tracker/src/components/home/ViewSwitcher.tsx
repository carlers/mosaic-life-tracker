import React from 'react';
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
  const current = !allowDailyReview && activeView === 'review' ? 'calendar' : activeView;
  const Icon = current === 'todo' ? ListChecks : current === 'diary' ? BookOpen : Calendar;
  const label = current === 'todo' ? 'Todo list' : current === 'diary' ? 'Diary' :
    current === 'review' ? 'Daily Review' : 'Calendar';

  return <div className="relative flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-[#333333] bg-surface text-white focus-within:ring-2 focus-within:ring-emerald-400">
    {current === 'review'
      ? <span aria-hidden="true" className="pointer-events-none text-xl leading-none">▥</span>
      : <Icon size={17} className="pointer-events-none" aria-hidden="true" />}
    <select aria-label={'View: ' + label} title={'View: ' + label} value={current}
      onChange={event => onViewChange(event.currentTarget.value as ViewType)}
      onPointerDown={event => event.stopPropagation()}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
      <option value="calendar">Calendar</option>
      <option value="todo">Todo list</option>
      <option value="diary">Diary</option>
      {allowDailyReview && <option value="review">Daily Review</option>}
    </select>
  </div>;
};
