import React from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

interface TaskRefCardProps {
  taskId: string;
  title: string;
  date: string;
  color: string;
}

export const TaskRefCard: React.FC<TaskRefCardProps> = ({
  title,
  date,
  color,
}) => {
  const dateLabel = date
    ? format(new Date(`${date}T00:00:00`), 'MMM d, yyyy')
    : '';
  return (
    <div className="flex items-start gap-2 bg-surface border border-[#333333] rounded-lg p-2 mb-1.5 max-w-full">
      <div
        className="w-1 flex-shrink-0 rounded-full self-stretch"
        style={{ backgroundColor: color || '#6B7280' }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{title}</p>
        {dateLabel && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
            <Calendar size={9} aria-hidden="true" />
            {dateLabel}
          </p>
        )}
      </div>
    </div>
  );
};
