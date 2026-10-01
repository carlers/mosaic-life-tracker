import React from 'react';
import { useDraggable } from '@dnd-kit/react';
import { TaskItem, type TaskItemProps } from './TaskItem';

export const DraggableTaskItem: React.FC<TaskItemProps> = (
  taskItemProps
) => {
  const { ref: dragRef, handleRef } = useDraggable({
    id: taskItemProps.task.id,
    type: 'task',
  });

  return (
    <>
      <div
        ref={dragRef}
        data-task-drag-proxy={taskItemProps.task.id}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <TaskItem
        {...taskItemProps}
        titleRef={handleRef}
        disableLayoutAnimation
      />
    </>
  );
};
