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
    // The full TaskItem is rendered by the shared DragOverlay. Never let
    // Feedback promote a second element or insert its own source placeholder.
    plugins: [Feedback.configure({ feedback: 'none', dropAnimation: null })],
  });

  return (
    <>
      <div
        ref={dragRef}
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
