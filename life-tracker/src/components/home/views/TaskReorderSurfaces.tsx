import React from 'react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import {
  categoryStartDropId,
  taskGapDropId,
  taskInsertDropId,
} from './taskReorder';

interface CategoryHeaderFrameProps {
  children: React.ReactNode;
  surfaceRef?: React.Ref<HTMLDivElement>;
  dropPosition?: 'start';
}

export const CategoryHeaderFrame: React.FC<CategoryHeaderFrameProps> = ({
  children,
  surfaceRef,
  dropPosition,
}) => (
  <div
    ref={surfaceRef}
    className="pb-2"
    data-task-category-drop-position={dropPosition}
  >
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

export const CategoryHeaderDropSurface: React.FC<{
  categoryId: string;
  children: React.ReactNode;
}> = ({ categoryId, children }) => {
  const { ref } = useDroppable({
    id: categoryStartDropId(categoryId),
    type: 'task-category',
    accept: 'task',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <CategoryHeaderFrame surfaceRef={ref} dropPosition="start">
      {children}
    </CategoryHeaderFrame>
  );
};

export const TaskGapDropSurface: React.FC<{
  categoryId: string;
  index: number;
  height: number;
}> = ({ categoryId, index, height }) => {
  const { ref } = useDroppable({
    id: taskGapDropId(categoryId, index),
    type: 'task-insert',
    accept: 'task',
    collisionPriority: CollisionPriority.Normal,
  });

  return (
    <div
      ref={ref}
      data-task-drop-gap="true"
      data-task-drop-index={index}
      aria-hidden="true"
      style={{ height: Math.max(1, height) }}
    />
  );
};

export const TaskRowDropSurface: React.FC<{
  categoryId: string;
  taskId: string;
  isActiveSource?: boolean;
  children: React.ReactNode;
}> = ({
  categoryId,
  taskId,
  isActiveSource = false,
  children,
}) => {
  const { ref: beforeRef } = useDroppable({
    id: taskInsertDropId(categoryId, taskId, 'before'),
    type: 'task-insert',
    accept: 'task',
    collisionPriority: CollisionPriority.High,
    disabled: isActiveSource,
  });
  const { ref: afterRef } = useDroppable({
    id: taskInsertDropId(categoryId, taskId, 'after'),
    type: 'task-insert',
    accept: 'task',
    collisionPriority: CollisionPriority.High,
    disabled: isActiveSource,
  });

  return (
    <div
      className="relative"
      data-task-slot-id={taskId}
      data-task-source-slot={isActiveSource ? 'true' : undefined}
      aria-hidden={isActiveSource ? true : undefined}
      style={
        isActiveSource
          ? {
              height: 0,
              opacity: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }
          : undefined
      }
    >
      <div
        ref={beforeRef}
        data-task-insert-position="before"
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: '50%',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={afterRef}
        data-task-insert-position="after"
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: 0,
          height: '50%',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
};
