import React from 'react';
import { BookOpen, Calendar, Columns3, ListChecks } from 'lucide-react';
import { CategoryHomeIcon } from './CategoryHomeIcon';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { ViewType } from './ViewSwitcher';

interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; includeCategory?: boolean; includeReview?: boolean; }

/** Shared accessible Mosaic listbox, loaded only after first Home-selector interaction. */
export const MosaicHomeViewPicker: React.FC<Props> = ({ activeView, onViewChange, includeCategory = true, includeReview = false }) => {
  const options = [
    { value: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
    { value: 'todo', label: 'To-do List', icon: <ListChecks size={18} /> },
    { value: 'diary', label: 'Diary', icon: <BookOpen size={18} /> },
    ...(includeCategory ? [{ value: 'category', label: 'Category View', icon: <CategoryHomeIcon /> }] : []),
    ...(includeReview ? [{ value: 'review', label: 'Daily Review', icon: <Columns3 size={18} /> }] : []),
  ];
  return <MosaicSelect variant="icon" label="Choose Home view" value={activeView}
    onChange={value => onViewChange(value as ViewType)}
    options={options} openOnMount notifyOnReselect
    triggerIcon={options.find(item => item.value === activeView)?.icon}
    className="w-[4.5rem]" />;
};
