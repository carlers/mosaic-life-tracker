import React from 'react';
import { useTaskImage } from '../../../hooks/useTaskImage';
import type { TaskDocument } from '../../../db/schema';

interface TaskBlockProps {
  task: TaskDocument;
  categoryColor: string;
}

export const TaskBlock: React.FC<TaskBlockProps> = ({ task, categoryColor }) => {
  const { imageUrl, isLoading } = useTaskImage(task.image);
  const bgColor = task.completed ? categoryColor : '#374151';
  const textColor = task.completed ? 'text-white' : 'text-gray-400';

  return (
    <div
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
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};