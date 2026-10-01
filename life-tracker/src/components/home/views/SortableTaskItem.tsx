import React from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { TaskItem, type TaskItemProps } from './TaskItem';

interface SortableTaskItemProps extends TaskItemProps {
  index: number;
  group: string;
  reorderEnabled: boolean;
}

export const SortableTaskItem: React.FC<SortableTaskItemProps> = ({
  index,
  group,
  reorderEnabled,
  ...taskItemProps
}) => {
  const sortable = useSortable({
    id: taskItemProps.task.id,
    index,
    group,
    type: 'task',
    accept: 'task',
    disabled: !reorderEnabled,
    transition: {
      duration: 180,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      idle: false,
    },
  });

  return (
    <TaskItem
      {...taskItemProps}
      rowRef={(node) => sortable.ref(node)}
      titleRef={(node) => sortable.handleRef(node)}
      isDragSource={sortable.isDragSource}
      disableLayoutAnimation={
        taskItemProps.disableLayoutAnimation || reorderEnabled
      }
    />
  );
};
