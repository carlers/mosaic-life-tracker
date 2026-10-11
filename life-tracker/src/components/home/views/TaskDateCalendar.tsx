import React, { useMemo, useState } from 'react';
import { addDays, addMonths, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TaskDateCalendarProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}

/** Always display a calendar immediately; do not depend on native showPicker availability. */
export const TaskDateCalendar: React.FC<TaskDateCalendarProps> = ({
  value, onChange, disabled = false,
}) => {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ? parseISO(value) : new Date()));
  const choose = (dateKey: string) => {
    setViewMonth(startOfMonth(parseISO(dateKey)));
    onChange(dateKey);
  };
  const dates = useMemo(() => {
    const first = startOfWeek(viewMonth, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, index) => addDays(first, index));
  }, [viewMonth]);
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div aria-label="Choose task date" className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" disabled={disabled}
          className="rounded-lg p-2 text-primary focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          onClick={() => setViewMonth(month => addMonths(month, -1))}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <strong className="text-sm text-primary" aria-live="polite">{format(viewMonth, 'MMMM yyyy')}</strong>
        <button type="button" aria-label="Next month" disabled={disabled}
          className="rounded-lg p-2 text-primary focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          onClick={() => setViewMonth(month => addMonths(month, 1))}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400" aria-hidden="true">
        {['S','M','T','W','T','F','S'].map((day, index) =>
          <span key={index}>{day}</span>)}
      </div>
      <div role="group" aria-label="Calendar dates" className="grid grid-cols-7 gap-1">
        {dates.map(date => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const selected = dateKey === value;
          return (
            <button key={dateKey} type="button" disabled={disabled}
              aria-label={format(date, 'MMMM d, yyyy')}
              aria-pressed={selected}
              aria-current={dateKey === today ? 'date' : undefined}
              onClick={() => choose(dateKey)}
              className={
                'flex aspect-square min-h-9 items-center justify-center rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/60 ' +
                (selected ? 'bg-emerald-500 text-black font-semibold' :
                  isSameMonth(date, viewMonth) ? 'text-primary hover:bg-surfaceHighlight' :
                    'text-gray-500 hover:bg-surfaceHighlight')
              }>
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={disabled}
          onClick={() => choose(today)}
          className="rounded-lg bg-surfaceHighlight px-3 py-2 text-sm text-primary">
          Today
        </button>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Jump to date
          <input type="date" aria-label="Jump to date"
            className="mosaic-native-color-scheme rounded-lg bg-surfaceHighlight p-2 text-sm text-primary"
            disabled={disabled} value={value}
            onChange={event => { if (event.target.value) choose(event.target.value); }} />
        </label>
      </div>
    </div>
  );
};
