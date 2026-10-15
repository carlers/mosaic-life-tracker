import React from 'react';
import { motion } from 'framer-motion';
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
    accept: ['task', 'diary'],
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
    accept: ['task', 'diary'],
    collisionPriority: CollisionPriority.Normal,
  });

  return (
    <motion.div
      layout="position"
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
      ref={ref}
      data-task-drop-gap="true"
      aria-hidden="true"
      style={{ height: Math.max(1, height) }}
    />
  );
};

export const TaskRowDropSurface: React.FC<{
  categoryId: string;
  taskId: string;
  isActiveSource?: boolean;
  animatePosition?: boolean;
  acceptTasksOnly?: boolean;
  children: React.ReactNode;
}> = ({
  categoryId,
  taskId,
  isActiveSource = false,
  animatePosition = false,
  acceptTasksOnly = false,
  children,
}) => {
  const { ref: beforeRef } = useDroppable({
    id: taskInsertDropId(categoryId, taskId, 'before'),
    type: 'task-insert',
    accept: acceptTasksOnly ? 'task' : ['task', 'diary'],
    collisionPriority: CollisionPriority.High,
    disabled: isActiveSource,
  });
  const { ref: afterRef } = useDroppable({
    id: taskInsertDropId(categoryId, taskId, 'after'),
    type: 'task-insert',
    accept: acceptTasksOnly ? 'task' : ['task', 'diary'],
    collisionPriority: CollisionPriority.High,
    disabled: isActiveSource,
  });

  return (
    <motion.div
      layout={animatePosition ? 'position' : false}
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
      className={isActiveSource ? 'relative !invisible' : 'relative'}
      data-task-source-slot={isActiveSource ? 'true' : undefined}
      aria-hidden={isActiveSource ? true : undefined}
      style={
        isActiveSource
          ? {
              // Out of flow only for the active session; never leave a zero-height
              // Motion-owned row behind after drop/cancel.
              position: 'absolute',
              width: '100%',
              visibility: 'hidden',
              pointerEvents: 'none',
              // Prevent the out-of-flow source from leaking over the next
              // category pill while Framer Motion measures moving rows.
              overflow: 'hidden',
            }
          : undefined
      }
    >
      <div
        ref={beforeRef}
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
    </motion.div>
  );
};

/** Dedicated diary-only day boundaries, never intercept a normal task drag. */
export const DiaryBoundaryDropSurface: React.FC<{ position: 'top' | 'bottom'; active: boolean }> = ({ position, active }) => {
  const { ref } = useDroppable({
    id: `diary-boundary:${position}`,
    type: 'diary-boundary',
    accept: 'diary',
    disabled: !active,
    collisionPriority: CollisionPriority.High,
  });
  return <div ref={ref} aria-hidden="true" data-diary-drop-boundary={position}
    style={{ height: active ? 16 : 0, pointerEvents: 'none' }}/>;
};
