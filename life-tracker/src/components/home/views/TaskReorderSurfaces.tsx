import React from 'react';
import { motion } from 'framer-motion';
import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import { useTaskReorderProximity } from './useTaskReorderProximity';
import { TaskRowRegistrationContext } from './taskRowRegistrationContext';

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

interface RowTargetsProps {
  categoryId: string;
  taskId: string;
  isActiveSource: boolean;
  acceptTasksOnly: boolean;
}
const dropZoneStyle = {
  position: 'absolute',
  insetInline: 0,
  height: '50%',
  pointerEvents: 'none',
} as const;

// Hook-safe boundary: offscreen rows do not call dnd-kit hooks.
const RegisteredRowTargets: React.FC<RowTargetsProps> = ({
  categoryId, taskId, isActiveSource, acceptTasksOnly,
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
    <>
      <div ref={beforeRef} aria-hidden="true" style={{ ...dropZoneStyle, top: 0 }} />
      <div ref={afterRef} aria-hidden="true" style={{ ...dropZoneStyle, bottom: 0 }} />
    </>
  );
};
// Inactive offscreen rows do not register with dnd-kit; extra invisible
// drop-target elements here did no work and increased dense Todo DOM cost.
export const TaskRowDropSurface: React.FC<{
  categoryId: string;
  taskId: string;
  isActiveSource?: boolean;
  animatePosition?: boolean;
  acceptTasksOnly?: boolean;
  eagerRegister?: boolean;
  children: React.ReactNode;
}> = ({
  categoryId,
  taskId,
  isActiveSource = false,
  animatePosition = false,
  acceptTasksOnly = false,
  eagerRegister = false,
  children,
}) => {
  const { ref, registered } = useTaskReorderProximity(eagerRegister);
  // An active source must remain registered even if drag auto-scrolls it away.
  const active = registered || isActiveSource;

  return (
    <motion.div
      ref={ref}
      data-panel-reorder-row="true"
      layout={animatePosition && active ? 'position' : false}
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
      className={isActiveSource ? 'relative !invisible' : 'relative'}
      data-task-source-slot={isActiveSource ? 'true' : undefined}
      aria-hidden={isActiveSource ? true : undefined}
      style={
        isActiveSource
          ? {
              position: 'absolute',
              width: '100%',
              visibility: 'hidden',
              pointerEvents: 'none',
              overflow: 'hidden',
            }
          : undefined
      }
    >
      <TaskRowRegistrationContext.Provider value={active}>
        {active && <RegisteredRowTargets categoryId={categoryId} taskId={taskId}
          isActiveSource={isActiveSource} acceptTasksOnly={acceptTasksOnly} />}
        {children}
      </TaskRowRegistrationContext.Provider>
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
