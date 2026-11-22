import React from 'react';
import { BookOpen, Calendar, ListChecks } from 'lucide-react';
import { CategoryHomeIcon } from './CategoryHomeIcon';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { ViewType } from './ViewSwitcher';

interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; includeCategory?: boolean; }

/** Shared accessible Mosaic listbox, loaded only after first Home-selector interaction. */
export const MosaicHomeViewPicker: React.FC<Props> = ({ activeView, onViewChange, includeCategory = true }) => {
  const options = [
    { value: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
    { value: 'todo', label: 'To-do List', icon: <ListChecks size={18} /> },
    { value: 'diary', label: 'Diary', icon: <BookOpen size={18} /> },
    { value: 'category', label: 'Category View', icon: <CategoryHomeIcon /> },
  ];
  return <MosaicSelect variant="icon" label="Choose Home view" value={activeView}
    onChange={value => onViewChange(value as ViewType)}
    options={includeCategory ? options : options.slice(0, 3)} openOnMount notifyOnReselect
    triggerIcon={options.find(item => item.value === activeView)?.icon}
    className="w-[4.5rem]" />;
};
