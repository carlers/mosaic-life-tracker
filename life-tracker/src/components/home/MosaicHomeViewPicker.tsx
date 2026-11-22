import React from 'react';
import { BookOpen, Calendar, Layers3, ListChecks } from 'lucide-react';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { ViewType } from './ViewSwitcher';

interface Props { activeView: ViewType; onViewChange: (view: ViewType) => void; }
export const MosaicHomeViewPicker: React.FC<Props> = ({ activeView, onViewChange }) => {
  const options = [
    { value: 'calendar', label: 'Calendar', icon: <Calendar size={17}/> },
    { value: 'todo', label: 'To-do List', icon: <ListChecks size={17}/> },
    { value: 'diary', label: 'Diary', icon: <BookOpen size={17}/> },
    { value: 'category', label: 'Category View', icon: <Layers3 size={17}/> },
  ];
  return <MosaicSelect variant="icon" label="Choose Home view" value={activeView}
    options={options} openOnMount triggerIcon={options.find(option => option.value === activeView)?.icon}
    onChange={value => onViewChange(value as ViewType)} />;
};
