import React, { useState } from 'react';
import { BookOpen, Calendar, ChevronDown, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'category';
interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; includeCategory?: boolean; }

export const ViewSwitcher: React.FC<Props> = ({ activeView, onViewChange, includeCategory = true }) => {
  const [Picker, setPicker] = useState<React.ComponentType<Props> | null>(null);
  const [loading, setLoading] = useState(false);
  if (Picker) return <Picker activeView={activeView} onViewChange={onViewChange} includeCategory={includeCategory} />;

  const Icon = activeView === 'todo' ? ListChecks :
    activeView === 'diary' ? BookOpen : Calendar;
  return <button type="button" aria-label="Choose Home view" disabled={loading}
    onPointerDown={event => event.stopPropagation()}
    onClick={() => {
      if (loading) return;
      setLoading(true);
      void import('./MosaicHomeViewPicker').then(
        module => setPicker(() => module.MosaicHomeViewPicker),
        () => setLoading(false)
      );
    }}
    className="mosaic-material-control inline-flex h-9 w-[4.5rem] shrink-0 items-center justify-between gap-3 rounded-lg border border-[#444444] bg-surfaceHighlight px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-70">
    {activeView === 'category' ? <span aria-hidden="true">▦</span> : <Icon size={18} aria-hidden="true" />}
    <ChevronDown size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
  </button>;
};
