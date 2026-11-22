import React from 'react';
import { BookOpen, Calendar, ChevronDown, Layers3, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'category';
interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; }

/** Compact native view picker adapted from the unshipped Daily Review implementation. */
export const ViewSwitcher: React.FC<Props> = ({ activeView, onViewChange }) => {
  const Icon = activeView === 'todo' ? ListChecks :
    activeView === 'diary' ? BookOpen : activeView === 'category' ? Layers3 : Calendar;
  return <div className="relative flex h-9 w-12 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#444444] bg-surface text-white focus-within:ring-2 focus-within:ring-emerald-500/60">
    <Icon size={17} aria-hidden="true" />
    <ChevronDown size={12} aria-hidden="true" />
    <select aria-label="Choose Home view" value={activeView}
      onChange={event => onViewChange(event.currentTarget.value as ViewType)}
      onPointerDown={event => event.stopPropagation()}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
      <option value="calendar">Calendar</option>
      <option value="todo">To-do List</option>
      <option value="diary">Diary</option>
      <option value="category">Category View</option>
    </select>
  </div>;
};
