import React, { useState } from 'react';
import { BookOpen, Calendar, ChevronDown, ListChecks } from 'lucide-react';
import { CategoryHomeIcon } from './CategoryHomeIcon';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'category' | 'review';
interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; includeCategory?: boolean; }

export const ViewSwitcher: React.FC<Props> = ({ activeView, onViewChange, includeCategory = true }) => {
  const [Picker, setPicker] = useState<React.ComponentType<Props> | null>(null);
  if (Picker) return <Picker activeView={activeView} onViewChange={onViewChange} includeCategory={includeCategory} />;

  const Icon = activeView === 'todo' ? ListChecks :
    activeView === 'diary' ? BookOpen : Calendar;
  return <button type="button" aria-label="Choose Home view"
    onPointerDown={event => event.stopPropagation()}
    onClick={() => {
      void import('./MosaicHomeViewPicker').then(
        module => setPicker(() => module.MosaicHomeViewPicker),
        () => { /* A subsequent tap retries a failed offline module load. */ }
      );
    }}
    className="mosaic-material-control inline-flex h-9 w-[4.5rem] shrink-0 items-center justify-between gap-3 rounded-lg border border-[#444444] bg-surfaceHighlight px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
    {activeView === 'review' ? <span aria-hidden="true" className="text-lg">Ⅲ</span> :
      activeView === 'category' ? <CategoryHomeIcon /> : <Icon size={18} aria-hidden="true" />}
    <ChevronDown size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
  </button>;
};
