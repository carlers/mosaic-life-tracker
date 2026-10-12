import React from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { LayoutGroup } from 'framer-motion';
import {
  PointerActivationConstraints,
  PointerSensor,
} from '@dnd-kit/dom';
import { TaskItem } from './TaskItem';
import { placementFromTaskDrop, type DiaryPlacement } from '../../../lib/diaryPlacement';
import { SharedTaskDragOverlay } from './SharedTaskRows';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import {
  isTaskPlacementCompatible,
  sortTaskPlacementByCompletion,
  canonicalPlacementAfterSortedDrop,
  type TaskCompletionSortMode,
  type TaskPlacement,
} from '../../../lib/taskOrder';
import {
  buildAffectedTaskOrderGroups,
  buildRenderedTasksByCategory,
  findTaskCategory,
  projectTaskPlacement,
  parseDropTarget,
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

interface DragSession {
  snapshot: TaskPlacement;
  canonicalSnapshot: TaskPlacement;
  mode: TaskCompletionSortMode;
  taskIdentity: Map<string, string>;
  projection: TaskPlacement;
  hasValidTarget: boolean;
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
    taskSortMode = 'manual',
  } = props;

  const [committedPlacement, setCommittedPlacement] =
    React.useState<CommittedPlacement | null>(null);
  const [activeDrag, setActiveDrag] =
    React.useState<ActiveTaskDrag | null>(null);

  const dragSessionRef = React.useRef<DragSession | null>(null);
  const sharedDragRef = React.useRef<SharedTaskItem | null>(null);
  const sharedTargetRef = React.useRef<string | null>(null);
  const diaryTargetRef = React.useRef<DiaryPlacement | null>(null);
  const [diaryDragging, setDiaryDragging] = React.useState(false);
  const [diaryPreviewPlacement, setDiaryPreviewPlacement] = React.useState<DiaryPlacement | null>(null);
  const [diaryDragHeight, setDiaryDragHeight] = React.useState(48);
  const [committedDiaryPlacement, setCommittedDiaryPlacement] = React.useState<DiaryPlacement | null>(null);
  const diaryDragRef = React.useRef(false);
  const [activeSharedDrag, setActiveSharedDrag] = React.useState<SharedTaskItem | null>(null);
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
  const displayPlacement = React.useMemo(
    () => sortTaskPlacementByCompletion(basePlacement, tasks, taskSortMode),
    [basePlacement, tasks, taskSortMode]
  );
  const renderPlacement = activeDrag?.snapshot ?? displayPlacement;

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
      if (taskId === `diary:${dateStr}` && props.diaryEnabled) {
        diaryTargetRef.current = null;
        setDiaryPreviewPlacement(null);
        setCommittedDiaryPlacement(null);
        setDiaryDragHeight(Math.max(24, source.element?.getBoundingClientRect().height ?? 48));
        diaryDragRef.current = true;
        setDiaryDragging(true);
        onReorderActiveChange?.(true);
        return;
      }
      if (!taskById.has(taskId)) {
        const shared = props.sharedItems?.find(item => item.id === taskId && item.status === 'accepted');
        if (shared) {
          sharedTargetRef.current = null;
          sharedDragRef.current = shared;
          setActiveSharedDrag(shared);
          onReorderActiveChange?.(true);
        }
        return;
      }

      const snapshot = displayPlacement;
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

      dragSessionRef.current = {
        snapshot,
        canonicalSnapshot: basePlacement,
        mode: taskSortMode,
        taskIdentity: new Map(tasks.map((task) => [task.id,
          `${task.userId}:${task.date}:${task.categoryId}:${task.completed}`])),
        projection: snapshot,
        hasValidTarget: false,
      };
      setActiveDrag(next);
      onReorderActiveChange?.(true);
    },
    [basePlacement, dateStr, displayPlacement, onReorderActiveChange, taskById, taskSortMode, tasks, props.sharedItems, props.diaryEnabled]
  );

  const handleDragOver = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragOver']
        >
      >[0]
    ) => {
      const session = dragSessionRef.current;
      const { source, target } = event.operation;
      if (diaryDragRef.current) {
        const key = target ? String(target.id) : '';
        const boundary = key === 'diary-boundary:top' || key === 'diary-boundary:bottom'
          ? { kind: key.endsWith('top') ? 'top' as const : 'bottom' as const } : null;
        const drop = key ? parseDropTarget(key) : null;
        const next = boundary ?? (drop && categoryIds.includes(drop.categoryId)
          ? placementFromTaskDrop(drop, displayPlacement[drop.categoryId] ?? []) : null);
        if (next) {
          diaryTargetRef.current = next;
          setDiaryPreviewPlacement(current =>
            JSON.stringify(current) === JSON.stringify(next) ? current : next);
        }
        return;
      }
      if (sharedDragRef.current) {
        const key = target ? String(target.id) : null;
        const drop = key ? parseDropTarget(key) : null;
        sharedTargetRef.current = drop && categoryIds.includes(drop.categoryId) ? key : null;
        return;
      }
      if (!session || !source) return;

      if (!target) {
        session.hasValidTarget = false;
        return;
      }

      const next = projectTaskPlacement(
        session.snapshot,
        String(source.id),
        String(target.id)
      );
      if (!next) {
        session.hasValidTarget = false;
        return;
      }

      session.hasValidTarget = true;
      if (
        taskPlacementsEqual(session.projection, next, categoryIds)
      ) {
        return;
      }

      session.projection = next;
      setActiveDrag((current) =>
        current ? { ...current, projection: next } : current
      );
    },
    [categoryIds, displayPlacement]
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
      if (diaryDragRef.current) {
        const key = event.operation.target ? String(event.operation.target.id) : '';
        const direct = key === 'diary-boundary:top' || key === 'diary-boundary:bottom'
          ? { kind: key.endsWith('top') ? 'top' as const : 'bottom' as const } : null;
        // A canceled/outside release must never commit the last stale hover target.
        const drop = key ? parseDropTarget(key) : null;
        const location = direct ?? (drop && categoryIds.includes(drop.categoryId)
          ? placementFromTaskDrop(drop, displayPlacement[drop.categoryId] ?? [])
          : null);
        diaryTargetRef.current = null;
        diaryDragRef.current = false;
        setDiaryDragging(false);
        setDiaryPreviewPlacement(null);
        if (!event.canceled && location && props.onMoveDiary) {
          // Keep the committed geometry while the local-first write propagates.
          // A rejected write restores the previous placement.
          setCommittedDiaryPlacement(location);
          void Promise.resolve()
            .then(() => props.onMoveDiary?.(location))
            .then(() => {
              window.requestAnimationFrame(() => {
                setCommittedDiaryPlacement(current =>
                  current && JSON.stringify(current) === JSON.stringify(location)
                    ? null : current
                );
              });
            })
            .catch(error => {
              setCommittedDiaryPlacement(null);
              props.onSharedMoveError?.(error);
            });
        }
        return;
      }
      const draggedShared = sharedDragRef.current;
      sharedDragRef.current = null;
      setActiveSharedDrag(null);
      if (draggedShared) {
        const target = event.operation.target;
        const targetKey = target ? String(target.id) : sharedTargetRef.current;
        sharedTargetRef.current = null;
        const drop = targetKey && parseDropTarget(targetKey);
        if (!event.canceled && drop && categoryIds.includes(drop.categoryId) && props.onMoveSharedTask) {
          void Promise.resolve(props.onMoveSharedTask(
            draggedShared, drop.categoryId, ('taskId' in drop ? drop.taskId || '' : ''), drop.position,
          )).catch(error => props.onSharedMoveError?.(error));
        }
        return;
      }

      const session = dragSessionRef.current;
      dragSessionRef.current = null;
      setActiveDrag(null);

      const source = event.operation.source;
      if (
        event.canceled ||
        !source ||
        !session?.hasValidTarget ||
        !onReorderTasks
      ) {
        return;
      }

      const { canonicalSnapshot, projection, mode } = session;
      if (mode !== taskSortMode ||
        tasks.some((task) => session.taskIdentity.get(task.id) !==
          `${task.userId}:${task.date}:${task.categoryId}:${task.completed}`) ||
        session.taskIdentity.size !== tasks.length ||
        !isTaskPlacementCompatible(canonicalSnapshot, livePlacement, categoryIds)) return;

      const finalPlacement = mode === 'manual'
        ? projection
        : canonicalPlacementAfterSortedDrop(canonicalSnapshot, projection, String(source.id), tasks);
      if (!finalPlacement ||
        !isTaskPlacementCompatible(finalPlacement, livePlacement, categoryIds) ||
        taskPlacementsEqual(canonicalSnapshot, finalPlacement, categoryIds)) return;

      const groups = buildAffectedTaskOrderGroups(
        canonicalSnapshot,
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
      displayPlacement,
      livePlacement,
      onReorderActiveChange,
      onReorderTasks,
      taskSortMode,
      tasks,
      props,
    ]
  );

  const overlayTask = activeDrag
    ? taskById.get(activeDrag.taskId) ?? null
    : null;
  const overlayCategoryId =
    activeDrag && overlayTask
      ? findTaskCategory(activeDrag.projection, activeDrag.taskId) ??
        overlayTask.categoryId
      : null;
  const overlayCategory = overlayCategoryId
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
      <LayoutGroup>
      <DaySlideContent
        {...props}
        diaryPlacement={committedDiaryPlacement ?? props.diaryPlacement}
        tasksByCategory={tasksByCategory}
        activeSharedDragId={activeSharedDrag?.id ?? null}
        activeDrag={activeDrag}
        diaryDragging={diaryDragging}
        diaryProjectedPlacement={diaryPreviewPlacement}
        diaryDragHeight={diaryDragHeight}
      />
      </LayoutGroup>
      <DragOverlay dropAnimation={null}>
        {activeSharedDrag && (
          <SharedTaskDragOverlay item={activeSharedDrag}
            color={categoryById.get(props.sharedCategoryFor?.(activeSharedDrag) || '')?.color || '#6B7280'} />
        )}
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
