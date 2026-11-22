import React from 'react';
import { BookOpen, Calendar, Layers3, ListChecks } from 'lucide-react';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { ViewType } from './ViewSwitcher';

interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; }

/** Shared accessible Mosaic listbox, loaded only after first Home-selector interaction. */
export const MosaicHomeViewPicker: React.FC<Props> = ({ activeView, onViewChange }) => {
  const options = [
    { value: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
    { value: 'todo', label: 'To-do List', icon: <ListChecks size={18} /> },
    { value: 'diary', label: 'Diary', icon: <BookOpen size={18} /> },
    { value: 'category', label: 'Category View', icon: <Layers3 size={18} /> },
  ];
  return <MosaicSelect variant="icon" label="Choose Home view" value={activeView}
    onChange={value => onViewChange(value as ViewType)}
    options={options} openOnMount
    triggerIcon={options.find(item => item.value === activeView)?.icon}
    className="w-[4.5rem]" />;
};
