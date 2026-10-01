import React from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import {
  PointerActivationConstraints,
  PointerSensor,
} from '@dnd-kit/dom';
import { TaskItem } from './TaskItem';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import {
  isTaskPlacementCompatible,
  type TaskPlacement,
} from '../../../lib/taskOrder';
import {
  buildAffectedTaskOrderGroups,
  buildRenderedTasksByCategory,
  findTaskCategory,
  projectTaskPlacement,
  taskPlacementsEqual,
  type ActiveTaskDrag,
} from './taskReorder';

const TASK_REORDER_POINTER_SENSOR = PointerSensor.configure({
  activationConstraints: [
    new PointerActivationConstraints.Delay({
      value: 500,
      tolerance: 8,
    }),
  ],
});

const noop = () => undefined;

interface CommittedPlacement {
  id: number;
  placement: TaskPlacement;
}

interface TaskReorderRuntimeProps extends DaySlideProps {
  categoryIds: string[];
  livePlacement: TaskPlacement;
}

export const TaskReorderRuntime: React.FC<TaskReorderRuntimeProps> = (
  props
) => {
  const {
    tasks,
    categories,
    currentUserId,
    categoryIds,
    livePlacement,
    onReorderTasks,
    onReorderActiveChange,
    dateStr,
  } = props;

  const [committedPlacement, setCommittedPlacement] =
    React.useState<CommittedPlacement | null>(null);
  const [activeDrag, setActiveDrag] =
    React.useState<ActiveTaskDrag | null>(null);

  const dragSnapshotRef = React.useRef<TaskPlacement | null>(null);
  const dragProjectionRef = React.useRef<TaskPlacement | null>(null);
  const dragTargetValidRef = React.useRef(false);
  const commitIdRef = React.useRef(0);

  const activeCommittedPlacement =
    committedPlacement &&
    isTaskPlacementCompatible(
      committedPlacement.placement,
      livePlacement,
      categoryIds
    )
      ? committedPlacement.placement
      : null;
  const basePlacement = activeCommittedPlacement ?? livePlacement;
  const renderPlacement = activeDrag?.snapshot ?? basePlacement;

  const tasksByCategory = React.useMemo(
    () =>
      buildRenderedTasksByCategory(tasks, renderPlacement, categoryIds),
    [categoryIds, renderPlacement, tasks]
  );
  const taskById = React.useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );
  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const handleDragStart = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragStart']
        >
      >[0]
    ) => {
      const { source } = event.operation;
      if (!source) return;

      const taskId = String(source.id);
      if (!taskById.has(taskId)) return;

      const snapshot = basePlacement;
      const initialCategoryId = findTaskCategory(snapshot, taskId);
      if (!initialCategoryId) return;

      const next: ActiveTaskDrag = {
        taskId,
        initialCategoryId,
        snapshot,
        projection: snapshot,
        rowHeight: Math.max(
          1,
          source.element?.getBoundingClientRect().height ?? 1
        ),
      };

      dragSnapshotRef.current = snapshot;
      dragProjectionRef.current = snapshot;
      dragTargetValidRef.current = false;
      setActiveDrag(next);
      onReorderActiveChange?.(true);
    },
    [basePlacement, onReorderActiveChange, taskById]
  );

  const handleDragOver = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragOver']
        >
      >[0]
    ) => {
      const snapshot = dragSnapshotRef.current;
      const { source, target } = event.operation;
      if (!snapshot || !source) return;

      if (!target) {
        dragTargetValidRef.current = false;
        return;
      }

      const next = projectTaskPlacement(
        snapshot,
        String(source.id),
        String(target.id)
      );
      if (!next) {
        dragTargetValidRef.current = false;
        return;
      }

      dragTargetValidRef.current = true;
      const previous = dragProjectionRef.current;
      if (
        previous &&
        taskPlacementsEqual(previous, next, categoryIds)
      ) {
        return;
      }

      dragProjectionRef.current = next;
      setActiveDrag((current) =>
        current ? { ...current, projection: next } : current
      );
    },
    [categoryIds]
  );

  const handleDragEnd = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragEnd']
        >
      >[0]
    ) => {
      onReorderActiveChange?.(false);

      const snapshot = dragSnapshotRef.current;
      const finalPlacement = dragProjectionRef.current;
      const hasValidTarget = dragTargetValidRef.current;

      dragSnapshotRef.current = null;
      dragProjectionRef.current = null;
      dragTargetValidRef.current = false;
      setActiveDrag(null);

      const source = event.operation.source;
      if (
        event.canceled ||
        !source ||
        !hasValidTarget ||
        !snapshot ||
        !finalPlacement ||
        !onReorderTasks
      ) {
        return;
      }

      if (
        !isTaskPlacementCompatible(
          finalPlacement,
          livePlacement,
          categoryIds
        ) ||
        taskPlacementsEqual(snapshot, finalPlacement, categoryIds)
      ) {
        return;
      }

      const groups = buildAffectedTaskOrderGroups(
        snapshot,
        finalPlacement,
        String(source.id)
      );
      if (groups.length === 0) return;

      const commitId = ++commitIdRef.current;
      setCommittedPlacement({
        id: commitId,
        placement: finalPlacement,
      });

      void Promise.resolve()
        .then(() => onReorderTasks(dateStr, groups))
        .then(() => {
          window.requestAnimationFrame(() => {
            setCommittedPlacement((current) =>
              current?.id === commitId ? null : current
            );
          });
        })
        .catch(() => {
          setCommittedPlacement((current) =>
            current && current.id >= commitId ? null : current
          );
        });
    },
    [
      categoryIds,
      dateStr,
      livePlacement,
      onReorderActiveChange,
      onReorderTasks,
    ]
  );

  const overlayTask: TaskDocument | null = activeDrag
    ? taskById.get(activeDrag.taskId) ?? null
    : null;
  const overlayCategoryId =
    activeDrag && overlayTask
      ? findTaskCategory(activeDrag.projection, activeDrag.taskId) ??
        overlayTask.categoryId
      : null;
  const overlayCategory: CategoryDocument | null = overlayCategoryId
    ? categoryById.get(overlayCategoryId) ?? null
    : null;

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        TASK_REORDER_POINTER_SENSOR,
      ]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <DaySlideContent
        {...props}
        tasksByCategory={tasksByCategory}
        activeDrag={activeDrag}
      />
      <DragOverlay dropAnimation={null}>
        {overlayTask && (
          <div
            aria-hidden="true"
            data-task-drag-overlay="true"
            style={{ pointerEvents: 'none' }}
          >
            <TaskItem
              task={overlayTask}
              categoryColor={overlayCategory?.color ?? '#4B5563'}
              currentUserId={currentUserId}
              onToggle={noop}
              onOpenActions={noop}
              onOpenMemo={noop}
              onEditStart={noop}
              onViewImage={noop}
              isEditing={false}
              editValue=""
              onEditChange={noop}
              onEditSave={noop}
              onEditCancel={noop}
              disableLayoutAnimation
              isDragOverlay
            />
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
};
