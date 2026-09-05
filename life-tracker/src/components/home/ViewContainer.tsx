import React from 'react';
import { CalendarView } from './views/CalendarView';
import { DiaryView } from './views/DiaryView';
import type { ViewType } from './ViewSwitcher';

interface ViewContainerProps {
  activeView: ViewType;
}

export const ViewContainer: React.FC<ViewContainerProps> = ({ activeView }) => {
  switch (activeView) {
    case 'calendar':
      return <CalendarView />;
    case 'diary':
      return <DiaryView />;
    default:
      return <CalendarView />;
  }
};