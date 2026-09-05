import React, { useState, useRef, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { motion, useAnimation } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { ViewToggle } from './ViewToggle';
import { DayViewSheet } from './DayViewSheet';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';

export type CalendarViewMode = 'month' | 'week';

export const CalendarView: React.FC = () => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusDate, setFocusDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // FIX: Lifted hooks to the top level to prevent re-subscription lag on view toggle
  const { tasks } = useTasks();
  const { categories } = useCategories();

  const categoriesMap = useMemo(() => {
    return categories.reduce((acc: Record<string, { color: string; name: string }>, cat: CategoryDocument) => {
      acc[cat.id] = { color: cat.color, name: cat.name };
      return acc;
    }, {});
  }, [categories]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const controls = useAnimation();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        setWidth(newWidth);
        controls.set({ x: -newWidth });
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [viewMode, controls]);

  const getPrevDate = () => viewMode === 'month' ? subMonths(focusDate, 1) : subWeeks(focusDate, 1);
  const getNextDate = () => viewMode === 'month' ? addMonths(focusDate, 1) : addWeeks(focusDate, 1);

  const handleDragEnd = (_event: any, info: any) => {
    if (isAnimating || width === 0) return;
    
    const threshold = width / 4;
    const snapTransition = { type: "tween" as const, duration: 0.2, ease: "easeOut" as const };
    const rejectTransition = { type: "tween" as const, duration: 0.15, ease: "easeOut" as const };
    
    if (info.offset.x < -threshold) {
      setIsAnimating(true);
      controls.start({ 
        x: -2 * width, 
        transition: snapTransition 
      }).then(() => {
        setFocusDate(getNextDate());
        controls.set({ x: -width });
        setIsAnimating(false);
      });
    } else if (info.offset.x > threshold) {
      setIsAnimating(true);
      controls.start({ 
        x: 0, 
        transition: snapTransition 
      }).then(() => {
        setFocusDate(getPrevDate());
        controls.set({ x: -width });
        setIsAnimating(false);
      });
    } else {
      controls.start({ 
        x: -width, 
        transition: rejectTransition 
      });
    }
  };

  const handlePrev = () => {
    if (isAnimating || width === 0) return;
    setIsAnimating(true);
    controls.start({ 
      x: 0, 
      transition: { type: "tween" as const, duration: 0.2, ease: "easeOut" as const } 
    }).then(() => {
      setFocusDate(getPrevDate());
      controls.set({ x: -width });
      setIsAnimating(false);
    });
  };

  const handleNext = () => {
    if (isAnimating || width === 0) return;
    setIsAnimating(true);
    controls.start({ 
      x: -2 * width, 
      transition: { type: "tween" as const, duration: 0.2, ease: "easeOut" as const } 
    }).then(() => {
      setFocusDate(getNextDate());
      controls.set({ x: -width });
      setIsAnimating(false);
    });
  };

  const handleToggle = () => {
    if (viewMode === 'month') {
      setFocusDate(startOfMonth(focusDate));
      setViewMode('week');
    } else {
      setViewMode('month');
    }
  };

  const weekStart = startOfWeek(focusDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: 0 });

  const title = viewMode === 'month' 
    ? format(focusDate, 'MMMM yyyy')
    : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

  // FIX: Pass tasks and categoriesMap down to the views
  const renderCalendarContent = (date: Date) => {
    if (viewMode === 'month') {
      return <MonthView focusDate={date} onDayClick={setSelectedDate} tasks={tasks} categoriesMap={categoriesMap} />;
    }
    return <WeekView focusDate={date} onDayClick={setSelectedDate} tasks={tasks} categoriesMap={categoriesMap} />;
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#333333]">
        <h2 className="text-lg font-bold text-white transition-all duration-200">
          {title}
        </h2>
        
        <div className="flex items-center gap-2">
          <ViewToggle activeMode={viewMode} onToggle={handleToggle} />
          
          <button 
            onClick={handlePrev} 
            disabled={isAnimating}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext} 
            disabled={isAnimating}
            className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden py-2 relative">
        <motion.div
          drag="x"
          dragConstraints={{ left: -2 * width, right: 0 }}
          dragElastic={0.1}
          animate={controls}
          onDragEnd={handleDragEnd}
          className="flex h-full cursor-grab active:cursor-grabbing"
          style={{ width: width * 3, touchAction: 'pan-y' }}
        >
          <div style={{ width }} className="flex-shrink-0 opacity-60 pointer-events-none">
            {renderCalendarContent(getPrevDate())}
          </div>
          <div style={{ width }} className="flex-shrink-0 h-full">
            {renderCalendarContent(focusDate)}
          </div>
          <div style={{ width }} className="flex-shrink-0 opacity-60 pointer-events-none">
            {renderCalendarContent(getNextDate())}
          </div>
        </motion.div>
      </div>

      <DayViewSheet 
        isOpen={!!selectedDate} 
        onClose={() => setSelectedDate(null)} 
        selectedDate={selectedDate || new Date()} 
        onDateChange={setSelectedDate}
      />
    </div>
  );
};