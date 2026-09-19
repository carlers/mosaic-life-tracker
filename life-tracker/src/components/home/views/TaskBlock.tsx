import React from 'react';
import { useImageLoadGate } from '../../../hooks/useImageLoadGate';
import { useTaskImage } from '../../../hooks/useTaskImage';
import type { TaskDocument } from '../../../db/schema';

interface TaskBlockProps {
  task: TaskDocument;
  categoryColor: string;
}

// TaskBlock is a decorative preview rendered inside DayCell. The cell
// itself owns the accessible name (date + task count); the block is a
// visual density indicator. It is wrapped in `aria-hidden` by DayCell,
// so no ARIA is added here — `title` remains for pointer-hover tooltips.
export const TaskBlock: React.FC<TaskBlockProps> = ({ task, categoryColor }) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLDivElement>();
  const { imageUrl, isLoading } = useTaskImage(task.image, shouldLoad);
  const bgColor = task.completed ? categoryColor : '#374151';
  const textColor = task.completed ? 'text-white' : 'text-gray-400';

  return (
    <div
      ref={targetRef}
      className={`text-[9px] px-1 py-0.5 w-full font-medium rounded-[3px] overflow-hidden ${textColor}`}
      style={{ backgroundColor: bgColor }}
      title={task.title}
    >
      <div className="flex flex-col gap-0.5">
        <span className="block overflow-hidden whitespace-nowrap">{task.title}</span>
        {task.image && (
          <div className="w-full h-10 mt-0.5 rounded-[2px] overflow-hidden bg-black/20">
            {isLoading ? (
              <div className="w-full h-full bg-gray-500/30 animate-pulse" />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
