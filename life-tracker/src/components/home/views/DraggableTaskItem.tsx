import React from 'react';
import { useDraggable } from '@dnd-kit/react';
import { Feedback } from '@dnd-kit/dom';
import { TaskItem, type TaskItemProps } from './TaskItem';

export const DraggableTaskItem: React.FC<TaskItemProps> = (
  taskItemProps
) => {
  const { ref: dragRef, handleRef } = useDraggable({
    id: taskItemProps.task.id,
    type: 'task',
    // The existing full TaskItem overlay is the only visible drag feedback.
    plugins: [Feedback.configure({ feedback: 'none' })],
  });

  return (
    <div ref={dragRef} data-task-drag-source="true">
      <TaskItem
        {...taskItemProps}
        titleRef={handleRef}
        disableLayoutAnimation
      />
    </div>
  );
};
