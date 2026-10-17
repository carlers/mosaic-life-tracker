import React from 'react';
import { UsersRound } from 'lucide-react';
import { getReadableTextColor } from '../../../constants/colors';
import { useImageLoadGate } from '../../../hooks/useImageLoadGate';
import { useTaskImage } from '../../../hooks/useTaskImage';
import type { TaskDocument } from '../../../db/schema';
import { IncompleteTaskBlockColorContext } from '../../../hooks/incompleteTaskBlockColorContext';

interface TaskBlockProps {
  task: TaskDocument;
  categoryColor: string;
  isShared?: boolean;
}

// TaskBlock is a decorative preview rendered inside DayCell. The cell
// itself owns the accessible name (date + task count); the block is a
// visual density indicator. It is wrapped in `aria-hidden` by DayCell,
// so no ARIA is added here — `title` remains for pointer-hover tooltips.
// Mount image decoding/storage observers only for tasks that actually have an image.
const TaskBlockImage: React.FC<{ image: string }> = ({ image }) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLDivElement>();
  const { imageUrl, isLoading } = useTaskImage(image, shouldLoad);
  return (
    <div ref={targetRef} className="w-full h-10 overflow-hidden bg-black/20">
      {isLoading ? (
        <div className="w-full h-full bg-gray-500/30 animate-pulse" />
      ) : imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async"
          className="w-full h-full object-cover" />
      ) : null}
    </div>
  );
};

export const TaskBlock: React.FC<TaskBlockProps> = ({ task, categoryColor, isShared = false }) => {
  const incompleteColorMode = React.useContext(IncompleteTaskBlockColorContext);
  const showCategoryText = !task.completed && incompleteColorMode === 'text';
  const showCategoryBorder = !task.completed && incompleteColorMode === 'border';
  // Theme remaps of text-gray-300 use !important in Light/Black;
  // omit that class when the category text override is active.
  const textColor = task.completed ? 'mosaic-done' : showCategoryText ? '' : 'text-gray-300';

  return (
    <div
      className={`text-[10.5px] pt-0.5 w-full font-semibold rounded-[4.5px] overflow-hidden ${textColor}`}
      style={{
        backgroundColor: task.completed ? categoryColor : 'var(--mosaic-task-incomplete-bg)',
        color: task.completed
          ? getReadableTextColor(categoryColor)
          : showCategoryText
            ? categoryColor
            : undefined,
        boxShadow: showCategoryBorder ? `inset 0 0 0 1px ${categoryColor}` : undefined,
      }}
      title={task.title}
    >
      <div className="flex flex-col gap-0.5">
        {/* Padding lives on the outer element; clipping lives on the inner
            one. Because the inner span has no padding, its clip rect ends
            exactly where the outer padding begins, so the right gutter is
            preserved on hard-cut text. */}
        <div className="px-[0.3rem] pb-0.5">
          <span className="flex items-center gap-0.5 overflow-hidden whitespace-nowrap">{isShared && <UsersRound size={10} className="shrink-0" aria-hidden="true" />}<span className="min-w-0">{task.title}</span></span>
        </div>
        {task.image && <TaskBlockImage image={task.image} />}
      </div>
    </div>
  );
};