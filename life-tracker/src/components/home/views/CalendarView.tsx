import React, { useState } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { ViewToggle } from './ViewToggle';
import { DayViewSheet } from './DayViewSheet'; // <-- ADD THIS

export type CalendarViewMode = 'month' | 'week';

export const CalendarView: React.FC = () => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate, setFocusDate] = useState(new Date());
  
  // ADD THIS: State for the Day View Sheet
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekStart = startOfWeek(focusDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 0 });

  const handlePrev = () => {
    if (viewMode === 'month') setFocusDate(subMonths(focusDate, 1));
    else setFocusDate(subWeeks(focusDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setFocusDate(addMonths(focusDate, 1));
    else setFocusDate(addWeeks(focusDate, 1));
  };

  const handleToggle = () => {
    if (viewMode === 'month') {
      setFocusDate(startOfMonth(focusDate));
      setViewMode('week');
    } else {
      setViewMode('month');
    }
  };

  // UPDATE THIS: Open the sheet instead of logging to console
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const headerTitle = viewMode === 'month' 
    ? format(focusDate, 'MMMM yyyy')
    : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#333333]">
        <h2 className="text-lg font-bold text-white">{headerTitle}</h2>
        
        <div className="flex items-center gap-2">
          <ViewToggle activeMode={viewMode} onToggle={handleToggle} />
          
          <button onClick={handlePrev} className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handleNext} className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden py-2">
        {viewMode === 'month' ? (
          <MonthView focusDate={focusDate} onDayClick={handleDayClick} />
        ) : (
          <WeekView focusDate={focusDate} onDayClick={handleDayClick} />
        )}
      </div>

      {/* ADD THIS: Render the DayViewSheet */}
      <DayViewSheet 
        isOpen={!!selectedDate} 
        onClose={() => setSelectedDate(null)} 
        selectedDate={selectedDate || new Date()} 
      />
    </div>
  );
};