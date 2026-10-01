import React from 'react';
import { useDraggable } from '@dnd-kit/react';
import { TaskItem, type TaskItemProps } from './TaskItem';

interface DraggableTaskItemProps extends TaskItemProps {
  reorderEnabled: boolean;
}

export const DraggableTaskItem: React.FC<DraggableTaskItemProps> = ({
  reorderEnabled,
  ...taskItemProps
}) => {
  const draggable = useDraggable({
    id: taskItemProps.task.id,
    type: 'task',
    disabled: !reorderEnabled,
  });

  return (
    <>
      <div
        ref={draggable.ref}
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
        titleRef={draggable.handleRef}
        disableLayoutAnimation={
          taskItemProps.disableLayoutAnimation || reorderEnabled
        }
      />
    </>
  );
};
