import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DayViewSheet } from '../components/home/views/DayViewSheet';
import { hasExpectedRouteParent, resolveRouteParent } from '../lib/primarySwipeNavigation';

export const BacklogPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [referenceDate] = useState(() => new Date());
  const parent = resolveRouteParent('/backlog', location.state) ?? '/home';
  const focusTaskId = location.state && typeof location.state === 'object' &&
    'focusTaskId' in location.state && typeof location.state.focusTaskId === 'string'
    ? location.state.focusTaskId : null;

  const handleBack = () => {
    if (hasExpectedRouteParent(location.key, location.state, parent)) navigate(-1);
    else navigate(parent, { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button type="button" onClick={handleBack} onPointerDown={(event) => event.stopPropagation()}
          aria-label="Back"
          className="-ml-2 rounded-lg p-2 text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-white">Backlogs</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto pb-24" aria-label="Backlog tasks">
        <DayViewSheet
          isOpen
          onClose={handleBack}
          selectedDate={referenceDate}
          renderMode="backlog"
          focusTaskId={focusTaskId}
        />
      </main>
    </div>
  );
};
