import React from 'react';
import { BookOpen, Calendar, Columns3, ListChecks } from 'lucide-react';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { ViewType } from './ViewSwitcher';

interface Props {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  allowDailyReview: boolean;
}

export const MosaicHomeViewPicker: React.FC<Props> = ({ activeView, onViewChange, allowDailyReview }) => {
  const entries = [
    { value: 'calendar', label: 'Calendar', icon: <Calendar size={17} /> },
    { value: 'todo', label: 'Todo list', icon: <ListChecks size={17} /> },
    { value: 'diary', label: 'Diary', icon: <BookOpen size={17} /> },
    ...(allowDailyReview ? [{ value: 'review', label: 'Daily Review', icon: <Columns3 size={17} /> }] : []),
  ];
  return <MosaicSelect variant="icon" label="Choose Home view" value={activeView}
    options={entries} openOnMount triggerIcon={entries.find(e => e.value === activeView)?.icon}
    onChange={value => onViewChange(value as ViewType)} />;
};
