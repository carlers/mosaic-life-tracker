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
    <TaskItem
      {...taskItemProps}
      rowRef={(node) => draggable.ref(node)}
      titleRef={(node) => draggable.handleRef(node)}
      isDragSource={draggable.isDragSource}
      disableLayoutAnimation={
        taskItemProps.disableLayoutAnimation || reorderEnabled
      }
    />
  );
};
