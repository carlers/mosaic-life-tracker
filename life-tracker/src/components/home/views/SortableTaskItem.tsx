import React from 'react';
import { Feedback } from '@dnd-kit/dom';
import { useSortable } from '@dnd-kit/react/sortable';
import { TaskItem, type TaskItemProps } from './TaskItem';

const TASK_DROP_FEEDBACK = Feedback.configure({
  dropAnimation: {
    duration: 160,
    easing: 'ease-out',
  },
});

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
    plugins: [TASK_DROP_FEEDBACK],
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
