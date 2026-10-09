import React from 'react';
import { getReadableTextColor } from '../../../constants/colors';
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
  const textColor = task.completed ? 'mosaic-task-done' : 'text-gray-300';

  return (
    <div
      ref={targetRef}
      className={`text-[10.5px] pt-0.5 w-full font-semibold rounded-[4.5px] overflow-hidden ${textColor}`}
      style={{ backgroundColor: task.completed ? categoryColor : 'var(--mosaic-task-incomplete-bg)', color: task.completed ? getReadableTextColor(categoryColor) : undefined }}
      title={task.title}
    >
      <div className="flex flex-col gap-0.5">
        {/* Padding lives on the outer element; clipping lives on the inner
            one. Because the inner span has no padding, its clip rect ends
            exactly where the outer padding begins, so the right gutter is
            preserved on hard-cut text. */}
        <div className="px-[0.3rem] pb-0.5">
          <span className="block overflow-hidden whitespace-nowrap">{task.title}</span>
        </div>
        {task.image && (
          <div className="w-full h-10 overflow-hidden bg-black/20">
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