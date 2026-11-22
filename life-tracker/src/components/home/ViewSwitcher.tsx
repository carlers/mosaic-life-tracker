import React, { useState } from 'react';
import { BookOpen, Calendar, ChevronDown, Layers3, ListChecks } from 'lucide-react';

export type ViewType = 'calendar' | 'todo' | 'diary' | 'category';
interface Props {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}
/** Delay popup code until interaction: Home remains network-independent at startup. */
export const ViewSwitcher: React.FC<Props> = ({ activeView, onViewChange }) => {
  const [Picker, setPicker] = useState<React.ComponentType<Props> | null>(null);
  if (Picker) return <Picker activeView={activeView} onViewChange={onViewChange} />;
  const Icon = activeView === 'todo' ? ListChecks :
    activeView === 'diary' ? BookOpen : activeView === 'category' ? Layers3 : Calendar;
  return <button type="button" aria-label="Choose Home view"
    onPointerDown={event => event.stopPropagation()}
    onClick={() => {
      void import('./MosaicHomeViewPicker')
        .then(m => setPicker(() => m.MosaicHomeViewPicker))
        .catch(() => { /* Keep retryable trigger on offline chunk failure. */ });
    }}
    className="flex h-9 w-12 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#444444] bg-surface text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
    <Icon size={17} aria-hidden="true" /><ChevronDown size={12} aria-hidden="true"/>
  </button>;
};
