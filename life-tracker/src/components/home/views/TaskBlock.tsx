import React from 'react';
import type { TaskDocument } from '../../../db/schema';

interface TaskBlockProps {
  task: TaskDocument;
  categoryColor: string;
}

export const TaskBlock: React.FC<TaskBlockProps> = ({ task, categoryColor }) => {
  const bgColor = task.completed ? categoryColor : '#374151';
  const textColor = task.completed ? 'text-white' : 'text-gray-400';

  return (
    <div
      className={`text-[9px] px-1 py-0.5 w-full font-medium rounded-[3px] overflow-hidden whitespace-nowrap ${textColor}`}
      style={{ backgroundColor: bgColor }}
      title={task.title}
    >
      <span className="block overflow-hidden whitespace-nowrap">{task.title}</span>
    </div>
  );
};