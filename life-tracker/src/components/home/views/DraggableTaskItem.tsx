import React from 'react';
import { useDraggable } from '@dnd-kit/react';
import { TaskItem, type TaskItemProps } from './TaskItem';
import { TaskRowRegistrationContext } from './taskRowRegistrationContext';

const RegisteredDraggableTaskItem: React.FC<TaskItemProps> = (
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
        aria-hidden="true"
        data-task-dnd-registered="true"
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

export const DraggableTaskItem: React.FC<TaskItemProps> = (props) => {
  const registered = React.useContext(TaskRowRegistrationContext);
  return registered
    ? <RegisteredDraggableTaskItem {...props} />
    : <TaskItem {...props} disableLayoutAnimation />;
};
