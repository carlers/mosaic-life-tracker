import React from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { LayoutGroup } from 'framer-motion';
import {
  PointerActivationConstraints,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/dom';
import { TaskItem } from './TaskItem';
import { diaryAfterTaskMove, placementFromTaskDrop, type DiaryPlacement } from '../../../lib/diaryPlacement';
import { SharedTaskDragOverlay } from './SharedTaskRows';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { DiaryDocument } from '../../../db/schema';
import { DaySlideContent, type DaySlideProps } from './DaySlideContent';
import { TASK_REORDER_KEYBOARD_SENSOR } from './taskKeyboardSensor';
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

// DragDropProvider is long-lived while a nested sheet is open. Keep the
// pure sensor configurator referentially stable across overlay state renders:
// recreating the prop cannot change the configured pointer/keyboard sensors.
const TASK_REORDER_SENSORS: NonNullable<React.ComponentProps<typeof DragDropProvider>['sensors']> =
  (defaults) => [
    ...defaults.filter((sensor) => sensor !== PointerSensor && sensor !== KeyboardSensor),
    TASK_REORDER_POINTER_SENSOR,
    TASK_REORDER_KEYBOARD_SENSOR,
  ];

// This is the SAME presentation used by the owner Diary Day View; the lazy
// module is already loaded when a diary drag can begin.
const DiaryDayCardOverlay = React.lazy(() => import('./DiaryDayPreview').then(
  module => ({ default: module.DiaryDayCard })
));

const noop = () => undefined;

interface ActiveDiaryOverlay {
  entry: DiaryDocument;
  expanded: boolean;
}

// Ignore collision target churn caused by Motion moving drop zones beneath a
// stationary finger. Genuine pointer movement still changes the target.
const stationaryPointer = (a: { x: number; y: number } | null, b: { x: number; y: number }) =>
  a !== null && Math.hypot(a.x - b.x, a.y - b.y) < 3;

interface CommittedPlacement {
  id: number;
  placement: TaskPlacement;
}

interface DragSession {
  taskId: string;
  snapshot: TaskPlacement;
  canonicalSnapshot: TaskPlacement;
  mode: TaskCompletionSortMode;
  taskIdentity: Map<string, string>;
  projection: TaskPlacement;
  hasValidTarget: boolean;
  acceptedPointer: { x: number; y: number } | null;
  diarySide: 'before' | 'after';
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
  const [settlingTaskId, setSettlingTaskId] = React.useState<string | null>(null);
  const [lastReleasedTask, setLastReleasedTask] = React.useState<{taskId: string; revision: number} | null>(null);
  const releaseRevisionRef = React.useRef(0);
  const [diarySettling, setDiarySettling] = React.useState(false);
  const settleForTwoFrames = (clear: () => void) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(clear));
  };

  const dragSessionRef = React.useRef<DragSession | null>(null);
  const sharedDragRef = React.useRef<SharedTaskItem | null>(null);
  const sharedTargetRef = React.useRef<string | null>(null);
  const diaryTargetRef = React.useRef<DiaryPlacement | null>(null);
  const [diaryDragging, setDiaryDragging] = React.useState(false);
  const [activeDiaryOverlay, setActiveDiaryOverlay] = React.useState<ActiveDiaryOverlay | null>(null);
  const [diaryReleaseRevision, setDiaryReleaseRevision] = React.useState(0);
  const [diaryPreviewPlacement, setDiaryPreviewPlacement] = React.useState<DiaryPlacement | null>(null);
  const [diaryDragHeight, setDiaryDragHeight] = React.useState(48);
  const [committedDiaryPlacement, setCommittedDiaryPlacement] = React.useState<DiaryPlacement | null>(null);
  const diaryDragRef = React.useRef(false);
  const diaryAcceptedPointerRef = React.useRef<{ x: number; y: number } | null>(null);
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
  const projectedDiaryPlacement = activeDrag && props.diaryEnabled && props.diaryPlacement
    ? diaryAfterTaskMove(
        props.diaryPlacement, activeDrag.snapshot, activeDrag.projection,
        activeDrag.taskId, activeDrag.diarySide
      ) : null;

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
        const snapshot = source.data as Partial<ActiveDiaryOverlay> | undefined;
        if (!snapshot?.entry) return;
        setActiveDiaryOverlay({entry: snapshot.entry, expanded: snapshot.expanded === true});
        diaryTargetRef.current = null;
        diaryAcceptedPointerRef.current = null;
        const initial = props.diaryPlacement ?? { kind: 'top' as const };
        setDiaryPreviewPlacement(initial.kind === 'slot' && !categoryIds.includes(initial.categoryId)
          ? { kind: 'top' } : initial);
        setCommittedDiaryPlacement(null);
        setDiarySettling(false);
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
        taskId,
        snapshot,
        canonicalSnapshot: basePlacement,
        mode: taskSortMode,
        taskIdentity: new Map(tasks.map((task) => [task.id,
          `${task.userId}:${task.date}:${task.categoryId}:${task.completed}`])),
        projection: snapshot,
        hasValidTarget: false,
        acceptedPointer: null,
        diarySide: 'before',
      };
      setSettlingTaskId(null);
      setActiveDrag(next);
      if (source.element && taskById.get(taskId)) {
        props.onCrossDayTaskStart?.(
          taskById.get(taskId)!, source.element.getBoundingClientRect(),
          event.nativeEvent,
          event.operation.position.current,
        );
      }
      onReorderActiveChange?.(true);
    },
    [basePlacement, categoryIds, dateStr, displayPlacement, onReorderActiveChange, taskById, taskSortMode, tasks, props.sharedItems, props.diaryEnabled, props.diaryPlacement]
  );

  // Drive cross-day edge navigation directly from the drag sensor. Browser
  // touch pointer streams are not guaranteed to bubble through window once
  // the source is captured or Swiper has intercepted native movement.
  const handleDragMove = React.useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragMove']>>[0]) => {
      const source = event.operation.source;
      if (!source || !dragSessionRef.current || String(source.id) !== dragSessionRef.current.taskId) return;
      props.onCrossDayTaskMove?.(event.operation.position.current, event.nativeEvent);
    },
    [props.onCrossDayTaskMove]
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
          if (stationaryPointer(diaryAcceptedPointerRef.current, event.operation.position.current)) return;
          diaryAcceptedPointerRef.current = { ...event.operation.position.current };
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

      // A projected gap can slide another drop zone under an unmoving pointer.
      // Keep the visible destination until the user actually moves again.
      if (session.hasValidTarget && stationaryPointer(session.acceptedPointer, event.operation.position.current)) return;

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
      session.acceptedPointer = { ...event.operation.position.current };
      const diaryTarget = parseDropTarget(String(target.id));
      const diarySide = diaryTarget && 'diarySide' in diaryTarget
        ? diaryTarget.diarySide ?? 'before' : 'before';
      if (taskPlacementsEqual(session.projection, next, categoryIds) &&
          session.diarySide === diarySide) return;
      session.diarySide = diarySide;
      session.projection = next;
      setActiveDrag(current =>
        current ? { ...current, projection: next, diarySide } : current
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
      if (event.operation.source &&
          props.onCrossDayNativeEnd?.(String(event.operation.source.id), event.canceled)) {
        // The carried task is now owned above Swiper. Its final pointer-up is
        // handled there, never by this stale per-date reorder projection.
        return;
      }
      onReorderActiveChange?.(false);
      if (diaryDragRef.current) {
        const key = event.operation.target ? String(event.operation.target.id) : '';
        const direct = key === 'diary-boundary:top' || key === 'diary-boundary:bottom'
          ? { kind: key.endsWith('top') ? 'top' as const : 'bottom' as const } : null;
        // A canceled/outside release must never commit the last stale hover target.
        const drop = key ? parseDropTarget(key) : null;
        const directLocation = direct ?? (drop && categoryIds.includes(drop.categoryId)
          ? placementFromTaskDrop(drop, displayPlacement[drop.categoryId] ?? [])
          : null);
        // Only trust the last preview if the finger has not moved since then;
        // never commit a previous hover on an outside/canceled release.
        const location = event.operation.target && stationaryPointer(diaryAcceptedPointerRef.current, event.operation.position.current)
          ? diaryTargetRef.current ?? directLocation : directLocation;
        diaryAcceptedPointerRef.current = null;
        diaryTargetRef.current = null;
        diaryDragRef.current = false;
        setActiveDiaryOverlay(null);
        // Fresh card at its settled location: never animate from a former
        // absolutely positioned source, just like the released task row.
        setDiaryReleaseRevision(current => current + 1);
        setDiaryDragging(false);
        setDiarySettling(true);
        settleForTwoFrames(() => setDiarySettling(false));
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
      // Suppress FLIP on the dragged source while its out-of-flow slot
      // becomes a normal row again; siblings still glide into place.
      if (session) {
        const releasedId = session.taskId;
        // Motion can retain a stale transform even after layout=false. A new
        // keyed source wrapper is measured at the final projected slot,
        // instead of visibly flying from its old hidden position.
        setLastReleasedTask({ taskId: releasedId, revision: ++releaseRevisionRef.current });
        setSettlingTaskId(releasedId);
        settleForTwoFrames(() => setSettlingTaskId(current =>
          current === releasedId ? null : current));
      }
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
        !isTaskPlacementCompatible(finalPlacement, livePlacement, categoryIds)) return;

      const tasksChanged = !taskPlacementsEqual(
        canonicalSnapshot, finalPlacement, categoryIds
      );
      const groups = tasksChanged ? buildAffectedTaskOrderGroups(
        canonicalSnapshot, finalPlacement, String(source.id)
      ) : [];
      const nextDiary = props.diaryEnabled && props.diaryPlacement
        ? diaryAfterTaskMove(props.diaryPlacement, session.snapshot,
            projection, session.taskId, session.diarySide)
        : null;
      const diaryChanged = Boolean(nextDiary && props.onMoveDiary &&
        JSON.stringify(nextDiary) !== JSON.stringify(props.diaryPlacement));
      if (!groups.length && !diaryChanged) return;

      const commitId = ++commitIdRef.current;
      if (groups.length) setCommittedPlacement({ id: commitId, placement: finalPlacement });
      if (diaryChanged && nextDiary) setCommittedDiaryPlacement(nextDiary);
      void Promise.resolve()
        .then(() => groups.length ? onReorderTasks(dateStr, groups) : undefined)
        .then(() => diaryChanged && nextDiary ? props.onMoveDiary?.(nextDiary) : undefined)
        .then(() => {
          window.requestAnimationFrame(() => {
            setCommittedPlacement(current => current?.id === commitId ? null : current);
            if (diaryChanged) setCommittedDiaryPlacement(current =>
              current && JSON.stringify(current) === JSON.stringify(nextDiary) ? null : current
            );
          });
        })
        .catch(() => {
          setCommittedPlacement(current =>
            current && current.id >= commitId ? null : current
          );
          if (diaryChanged) setCommittedDiaryPlacement(null);
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
      sensors={TASK_REORDER_SENSORS}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <LayoutGroup>
      <DaySlideContent
        {...props}
        diaryPlacement={committedDiaryPlacement ?? projectedDiaryPlacement ?? props.diaryPlacement}
        tasksByCategory={tasksByCategory}
        activeSharedDragId={activeSharedDrag?.id ?? null}
        activeDrag={activeDrag}
        diaryDragging={diaryDragging}
        diaryReleaseRevision={diaryReleaseRevision}
        diarySettling={diarySettling}
        settlingTaskId={settlingTaskId}
        lastReleasedTask={lastReleasedTask}
        diaryProjectedPlacement={diaryPreviewPlacement}
        diaryDragHeight={diaryDragHeight}
      />
      </LayoutGroup>
      <DragOverlay dropAnimation={null}>
        {activeSharedDrag && (
          <SharedTaskDragOverlay item={activeSharedDrag}
            color={categoryById.get(props.sharedCategoryFor?.(activeSharedDrag) || '')?.color || '#6B7280'} />
        )}
        {activeDiaryOverlay && (
          <div aria-hidden="true" data-diary-drag-overlay="true"
            style={{pointerEvents: 'none'}}>
            <React.Suspense fallback={null}>
              <div className="my-2 min-w-0">
                <DiaryDayCardOverlay
                  entry={activeDiaryOverlay.entry}
                  expanded={activeDiaryOverlay.expanded}
                  onOpen={noop}
                />
              </div>
            </React.Suspense>
          </div>
        )}
        {overlayTask && props.crossDayDragTaskId !== overlayTask.id && (
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
