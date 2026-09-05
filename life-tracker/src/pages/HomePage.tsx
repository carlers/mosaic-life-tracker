import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/home/TopBar';
import { ViewContainer } from '../components/home/ViewContainer';
import type { ViewType } from '../components/home/ViewSwitcher';

export const HomePage: React.FC = () => {
  // Initialize state from localStorage to implement View Memory
  const [activeView, setActiveView] = useState<ViewType>(() => {
    const saved = localStorage.getItem('mosaic_activeView');
    if (saved === 'calendar' || saved === 'todo' || saved === 'diary') {
      return saved;
    }
    return 'calendar'; // Default fallback
  });

  // Save to localStorage whenever the view changes
  useEffect(() => {
    localStorage.setItem('mosaic_activeView', activeView);
  }, [activeView]);

  const handleViewChange = (view: ViewType) => {
    setActiveView(view);
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Sticky Top Bar */}
      <TopBar activeView={activeView} onViewChange={handleViewChange} />
      
      {/* Content Area */}
      <div className="flex-1">
        <ViewContainer activeView={activeView} />
      </div>
    </div>
  );
};