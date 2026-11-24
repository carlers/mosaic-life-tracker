import React from 'react';
import { createPortal } from 'react-dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { Rectangle } from '@dnd-kit/geometry';
import { LayoutGroup } from 'framer-motion';
import {
  PointerActivationConstraints,
  PointerSensor,
  KeyboardSensor,
  Cursor,
  PreventSelection,
  Feedback,
} from '@dnd-kit/dom';
import { TaskItem } from './TaskItem';
import { diaryAfterTaskMove, placementFromTaskDrop, resolveDiaryDragRelease, sameDiaryPlacement, type DiaryPlacement } from '../../../lib/diaryPlacement';
import { captureDiaryGroupDragSnapshot, type DiaryGroupDragSnapshot } from './diaryGroupDragSnapshot';
import { DiaryGroupDragVisual } from './DiaryGroupDragVisual';
import type { DiaryDayUiSession } from './DiaryDayPreview';
import { SharedTaskDragOverlay } from './SharedTaskRows';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import type { DiaryDocument } from '../../../db/schema';
import { projectDiaryNoteLayout, type PlacedDiaryNote } from '../../../lib/diaryNoteLayout';
import { projectDiaryMixedMove, type DiaryMixedProjection } from '../../../lib/diaryMixedOrder';
import { diaryDayLayoutKey, diaryNotePositionKey, resolveDiaryNotePosition } from '../../../lib/diaryNotes';
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

// #2298 isolated evidence probe. Keep the default plugins intact without an
// explicit URL flag. Removal modes are diagnostic only; the actual replacement
// for selection/cursor feedback requires user-device acceptance.
type DragPlugins = NonNullable<React.ComponentProps<typeof DragDropProvider>['plugins']>;
const DRAG_PROBE_NO_CURSOR: DragPlugins =
  defaults => defaults.filter(plugin => plugin !== Cursor);
const DRAG_PROBE_NO_SELECTION: DragPlugins =
  defaults => defaults.filter(plugin => plugin !== PreventSelection);
const DRAG_PROBE_NO_GLOBAL_STYLES: DragPlugins =
  defaults => defaults.filter(plugin => plugin !== Cursor && plugin !== PreventSelection);
const DRAG_PROBE_NO_FEEDBACK: DragPlugins =
  defaults => defaults.filter(plugin => plugin !== Cursor && plugin !== PreventSelection &&
    plugin !== Feedback);
function diagnosticDragPlugins(): DragPlugins | undefined {
  if (typeof window === 'undefined') return undefined;
  switch (new URLSearchParams(window.location.search).get('mosaic2298Plugins')) {
    case 'cursorless': return DRAG_PROBE_NO_CURSOR;
    case 'selectionless': return DRAG_PROBE_NO_SELECTION;
    case 'scoped': return DRAG_PROBE_NO_GLOBAL_STYLES;
    case 'no-feedback': return DRAG_PROBE_NO_FEEDBACK;
    case 'manual-overlay': return DRAG_PROBE_NO_FEEDBACK;
    default: return undefined;
  }
}
const PROBE_DRAG_PLUGINS = diagnosticDragPlugins();
const USE_MANUAL_OVERLAY = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mosaic2298Plugins') === 'manual-overlay';

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
const EMPTY_OWNER_DIARY_ENTRIES: DiaryDocument[] = [];

interface ActiveDiaryOverlay {
  entry: DiaryDocument;
  expanded: boolean;
  visual: DiaryGroupDragSnapshot | null;
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
  noteSnapshot: readonly PlacedDiaryNote[];
  mixedProjection: DiaryMixedProjection | null;
  noteTarget: { id: string; side: 'before' | 'after' } | null;
  lastTargetId: string | null;
}

interface TaskReorderRuntimeProps extends DaySlideProps {
  categoryIds: string[];
  livePlacement: TaskPlacement;
  diaryReorderEntries?: DiaryDocument[];
  diaryReorderGetSetting?: (key: string) => unknown;
  diaryReorderSetSetting?: (key: string, value: unknown) => Promise<void>;
}

const readEmptySetting = () => undefined;

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

  // Experimental pointer canvas: replace Feedback's repeated DOMRectangle
  // projections with one source read and compositor-only move updates.
  // React commits only on pickup/release, never for pointer movement.
  const [overlayAnchor, setOverlayAnchor] = React.useState<{
    left: number; top: number; width: number;
  } | null>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const originRef = React.useRef<{ x: number; y: number } | null>(null);
  const deltaRef = React.useRef({ x: 0, y: 0 });
  const frameRef = React.useRef<number | null>(null);
  const nativePointerSeenRef = React.useRef(false);
  // Feedback ordinarily synchronizes dragOperation.shape with the moving
  // overlay; the collision engine cannot follow cross-category targets without
  // this value. Maintain a translated Rectangle from the single pickup read.
  type DragOperationRef = Parameters<NonNullable<
    React.ComponentProps<typeof DragDropProvider>['onDragStart']
  >>[0]['operation'];
  const dragOperationRef = React.useRef<DragOperationRef | null>(null);
  const sourceRectangleRef = React.useRef<{
    left: number; top: number; width: number; height: number;
  } | null>(null);
  const synchronizeCollisionShape = React.useCallback((x: number, y: number) => {
    const source = sourceRectangleRef.current;
    const operation = dragOperationRef.current;
    if (!USE_MANUAL_OVERLAY || !source || !operation) return;
    operation.shape = new Rectangle(
      source.left + x, source.top + y, source.width, source.height,
    );
  }, []);
  // Pointer events are captured before the DnD manager schedules reactive
  // position updates. A compositor transform write needs no geometry read and
  // preserves the exact cursor/finger offset on each pointer sample.
  const handleManualNativePointer = React.useCallback((event: PointerEvent) => {
    const origin = originRef.current;
    if (!USE_MANUAL_OVERLAY || !origin) return;
    nativePointerSeenRef.current = true;
    const x = event.clientX - origin.x;
    const y = event.clientY - origin.y;
    deltaRef.current = { x, y };
    synchronizeCollisionShape(x, y);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.setProperty('--mosaic-drag-x', x + 'px');
      canvas.style.setProperty('--mosaic-drag-y', y + 'px');
    }
  }, [synchronizeCollisionShape]);
  const beginManualOverlay = React.useCallback((
    source: Element | null, point: { x: number; y: number },
    operation: DragOperationRef,
  ) => {
    if (!USE_MANUAL_OVERLAY || !source) return;
    const rect = source.getBoundingClientRect();
    originRef.current = { x: point.x, y: point.y };
    deltaRef.current = { x: 0, y: 0 };
    sourceRectangleRef.current = {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    dragOperationRef.current = operation;
    synchronizeCollisionShape(0, 0);
    nativePointerSeenRef.current = false;
    window.addEventListener('pointermove', handleManualNativePointer, true);
    setOverlayAnchor({ left: rect.left, top: rect.top, width: rect.width });
  }, [handleManualNativePointer, synchronizeCollisionShape]);
  const moveManualOverlay = React.useCallback((point: { x: number; y: number }) => {
    const origin = originRef.current;
    if (!USE_MANUAL_OVERLAY || !origin || nativePointerSeenRef.current) return;
    deltaRef.current = { x: point.x - origin.x, y: point.y - origin.y };
    synchronizeCollisionShape(deltaRef.current.x, deltaRef.current.y);
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const target = canvasRef.current;
      if (target) {
        target.style.setProperty('--mosaic-drag-x', deltaRef.current.x + 'px');
        target.style.setProperty('--mosaic-drag-y', deltaRef.current.y + 'px');
      }
    });
  }, [synchronizeCollisionShape]);
  const endManualOverlay = React.useCallback(() => {
    if (!USE_MANUAL_OVERLAY) return;
    window.removeEventListener('pointermove', handleManualNativePointer, true);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    originRef.current = null;
    dragOperationRef.current = null;
    sourceRectangleRef.current = null;
    setOverlayAnchor(null);
  }, [handleManualNativePointer]);
  React.useLayoutEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.setProperty('--mosaic-drag-x', deltaRef.current.x + 'px');
      canvasRef.current.style.setProperty('--mosaic-drag-y', deltaRef.current.y + 'px');
    }
  }, [overlayAnchor]);
  React.useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    window.removeEventListener('pointermove', handleManualNativePointer, true);
  }, [handleManualNativePointer]);

  const ownerDiaryEntries = props.diaryReorderEntries ?? EMPTY_OWNER_DIARY_ENTRIES;
  const getSetting = props.diaryReorderGetSetting ?? readEmptySetting;
  const setSetting = props.diaryReorderSetSetting;
  const [committedNoteOverrides, setCommittedNoteOverrides] = React.useState<
    Map<string, { value: unknown; baseline: unknown }>>(() => new Map());
  const currentNoteOverrides = React.useMemo(
    () => new Map([...committedNoteOverrides]
      .filter(([key, entry]) =>
        JSON.stringify(getSetting(key)) === JSON.stringify(entry.baseline))
      .map(([key, entry]) => [key, entry.value])),
    [committedNoteOverrides, getSetting]);
  // Read-time baseline comparison makes optimistic anchors inert as soon as
  // sync reflects a newer value; no effect-driven state update is necessary.
  const [committedPlacement, setCommittedPlacement] =
    React.useState<CommittedPlacement | null>(null);
  // Task + Diary mixed moves can update several task rows and private note
  // anchors in separate local-first subscriptions. Clearing the optimistic
  // task order after just one animation frame exposes stale rows and makes
  // first/last gaps visibly collapse before their final position returns.
  React.useEffect(() => {
    if (!committedPlacement || !taskPlacementsEqual(
      committedPlacement.placement, livePlacement, categoryIds)) return;
    const frame = window.requestAnimationFrame(() => {
      setCommittedPlacement(current =>
        current?.id === committedPlacement.id ? null : current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [committedPlacement, livePlacement, categoryIds]);
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
  // Store only user-changed view state above the keyed settling frame.
  // No ref reads during render and no synchronized/backend writes.
  const [diaryGroupSession, setDiaryGroupSession] = React.useState<DiaryDayUiSession | null>(null);
  const [activeDiaryOverlay, setActiveDiaryOverlay] = React.useState<ActiveDiaryOverlay | null>(null);
  const [diaryReleaseRevision, setDiaryReleaseRevision] = React.useState(0);
  const [diaryPreviewPlacement, setDiaryPreviewPlacement] = React.useState<DiaryPlacement | null>(null);
  const [diaryDragHeight, setDiaryDragHeight] = React.useState(48);
  const [committedDiaryPlacement, setCommittedDiaryPlacement] = React.useState<DiaryPlacement | null>(null);
  // A successful local write may precede the subscribed settings update by
  // more than one paint. Retain the optimistic destination until the parent
  // actually observes it; otherwise the group briefly snaps to its old slot.
  React.useEffect(() => {
    if (!committedDiaryPlacement || !sameDiaryPlacement(
      committedDiaryPlacement, props.diaryPlacement ?? null
    )) return;
    // The observed setting already matches. Clear only on the next paint,
    // preserving React's effect scheduling contract without visible rollback.
    const frame = window.requestAnimationFrame(() => {
      setCommittedDiaryPlacement(current =>
        sameDiaryPlacement(current, committedDiaryPlacement) ? null : current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [committedDiaryPlacement, props.diaryPlacement]);
  const diaryDragRef = React.useRef(false);
  const diaryAcceptedPointerRef = React.useRef<{ x: number; y: number } | null>(null);
  const diaryProjectionFrameRef = React.useRef<number | null>(null);
  const pendingDiaryProjectionRef = React.useRef<DiaryPlacement | null>(null);
  const cancelPendingDiaryProjection = React.useCallback(() => {
    if (diaryProjectionFrameRef.current !== null) {
      window.cancelAnimationFrame(diaryProjectionFrameRef.current);
      diaryProjectionFrameRef.current = null;
    }
    pendingDiaryProjectionRef.current = null;
  }, []);
  React.useEffect(() => cancelPendingDiaryProjection, [cancelPendingDiaryProjection]);
  const queueDiaryProjection = React.useCallback((next: DiaryPlacement) => {
    pendingDiaryProjectionRef.current = next;
    if (diaryProjectionFrameRef.current !== null) return;
    // One category/list reflow per paint, even if collision targets flip
    // multiple times within a pointer frame. The committed target remains
    // synchronous in diaryTargetRef and is never lost on pointer release.
    diaryProjectionFrameRef.current = window.requestAnimationFrame(() => {
      diaryProjectionFrameRef.current = null;
      const target = pendingDiaryProjectionRef.current;
      pendingDiaryProjectionRef.current = null;
      if (diaryDragRef.current && target) {
        setDiaryPreviewPlacement(current =>
          sameDiaryPlacement(current, target) ? current : target);
      }
    });
  }, []);
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
  const noteTaskSnapshot = React.useMemo(
    () => buildRenderedTasksByCategory(tasks, displayPlacement, categoryIds),
    [tasks, displayPlacement, categoryIds]);
  const runtimeNotePlan = React.useMemo(
    () => projectDiaryNoteLayout(dateStr, ownerDiaryEntries,
      categories, noteTaskSnapshot, key => key === diaryDayLayoutKey(dateStr)
        ? 'distributed' : getSetting(key)),
    [dateStr, ownerDiaryEntries, categories, noteTaskSnapshot, getSetting]);
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
      >[0],
      manager: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragStart']>>[1],
    ) => {
      const { source } = event.operation;
      if (!source) return;
      // React's event carries a snapshot. The collision observer watches the
      // actual manager operation; updating the snapshot cannot change targets.
      beginManualOverlay(source.element ?? null, event.operation.position.current, manager.dragOperation);

      const taskId = String(source.id);
      if (taskId === `diary:${dateStr}` && props.diaryEnabled) {
        const snapshot = source.data as Partial<ActiveDiaryOverlay> | undefined;
        if (!snapshot?.entry) return;
        // Snapshot the entire rendered group BEFORE its source becomes hidden.
        // Prior code floated only the first entry while moving a many-entry
        // container, mismatching the measured slot and painted overlay.
        const visual = captureDiaryGroupDragSnapshot(source.element ?? null);
        setActiveDiaryOverlay({entry: snapshot.entry,
          expanded: snapshot.expanded === true, visual});
        cancelPendingDiaryProjection();
        diaryTargetRef.current = null;
        diaryAcceptedPointerRef.current = null;
        const initial = committedDiaryPlacement ?? props.diaryPlacement ?? { kind: 'top' as const };
        setDiaryPreviewPlacement(initial.kind === 'slot' && !categoryIds.includes(initial.categoryId)
          ? { kind: 'top' } : initial);
        setCommittedDiaryPlacement(null);
        setDiarySettling(false);
        setDiaryDragHeight(visual?.height ??
          Math.max(24, source.element?.getBoundingClientRect().height ?? 48));
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
        noteSnapshot: runtimeNotePlan.placed,
        mixedProjection: null,
        noteTarget: null,
        lastTargetId: null,
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
    [basePlacement, beginManualOverlay, cancelPendingDiaryProjection, categoryIds, committedDiaryPlacement, dateStr, displayPlacement, onReorderActiveChange, taskById, taskSortMode, tasks, props.sharedItems, props.diaryEnabled, props.diaryPlacement, runtimeNotePlan.placed]
  );

  // Drive cross-day edge navigation directly from the drag sensor. Browser
  // touch pointer streams are not guaranteed to bubble through window once
  // the source is captured or Swiper has intercepted native movement.
  const handleDragMove = React.useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragMove']>>[0]) => {
      moveManualOverlay(event.operation.position.current);
      const source = event.operation.source;
      if (!source || !dragSessionRef.current || String(source.id) !== dragSessionRef.current.taskId) return;
      props.onCrossDayTaskMove?.(event.operation.position.current, event.nativeEvent);
    },
    [moveManualOverlay, props.onCrossDayTaskMove]
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
        const next = boundary ?? (drop && drop.position !== 'note' &&
          categoryIds.includes(drop.categoryId)
          ? placementFromTaskDrop(drop, displayPlacement[drop.categoryId] ?? []) : null);
        if (next) {
          if (stationaryPointer(diaryAcceptedPointerRef.current, event.operation.position.current)) return;
          diaryAcceptedPointerRef.current = { ...event.operation.position.current };
          if (sameDiaryPlacement(diaryTargetRef.current, next)) return;
          diaryTargetRef.current = next;
          queueDiaryProjection(next);
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
        session.lastTargetId = null;
        return;
      }
      const targetId = String(target.id);
      // dnd-kit may emit onDragOver every pointer sample even with the same
      // stable droppable. Nothing needs projecting or measuring in that case.
      if (session.hasValidTarget && session.lastTargetId === targetId) return;

      const diaryTarget = parseDropTarget(targetId);
      const mixed = diaryTarget && session.noteSnapshot.length
        ? projectDiaryMixedMove(session.snapshot, session.noteSnapshot,
            { kind: 'task', id: String(source.id) }, diaryTarget)
        : null;
      const next = mixed?.tasks ?? projectTaskPlacement(
        session.snapshot, String(source.id), String(target.id)
      );
      if (!next) {
        session.hasValidTarget = false;
        session.lastTargetId = null;
        return;
      }
      const priorNoteTarget = session.noteTarget;
      session.lastTargetId = targetId;
      session.mixedProjection = mixed;
      session.noteTarget = diaryTarget?.position === 'note'
        ? { id: diaryTarget.noteId, side: diaryTarget.side } : null;
      session.hasValidTarget = true;
      session.acceptedPointer = { ...event.operation.position.current };
      const diarySide = diaryTarget && 'diarySide' in diaryTarget
        ? diaryTarget.diarySide ?? 'before' : 'before';
      if (taskPlacementsEqual(session.projection, next, categoryIds) &&
          session.diarySide === diarySide &&
          priorNoteTarget?.id === session.noteTarget?.id &&
          priorNoteTarget?.side === session.noteTarget?.side) return;
      session.diarySide = diarySide;
      session.projection = next;
      setActiveDrag(current =>
        current ? { ...current, projection: next, diarySide,
          noteTarget: session.noteTarget } : current
      );
    },
    [categoryIds, displayPlacement, queueDiaryProjection]
  );

  const handleDragEnd = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragEnd']
        >
      >[0]
    ) => {
      endManualOverlay();
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
        const directLocation = direct ?? (drop && drop.position !== 'note' &&
          categoryIds.includes(drop.categoryId)
          ? placementFromTaskDrop(drop, displayPlacement[drop.categoryId] ?? [])
          : null);
        // The live gap, not the release-time collision, is the destination.
        // Motion's projected gap can cover/displace its own droppable at
        // pointer-up, producing a null or stale target despite a valid hover.
        // Reject actual outside releases/cancellations, never a transient
        // collision change beneath the pointer.
        const sourceDay = event.operation.source?.element
          ?.closest<HTMLElement>('[data-testid="day-slide"]');
        const native = event.nativeEvent;
        const hasClientPoint = native != null && 'clientX' in native && 'clientY' in native &&
          typeof native.clientX === 'number' && typeof native.clientY === 'number';
        const isKeyboard = native != null && 'key' in native;
        const releasePoint = isKeyboard ? null : hasClientPoint
          ? { x: (native as MouseEvent).clientX, y: (native as MouseEvent).clientY }
          : event.operation.position.current;
        const rect = sourceDay?.getBoundingClientRect();
        const insideDay = !releasePoint || Boolean(rect &&
          releasePoint.x >= Math.max(0, rect.left) &&
          releasePoint.x <= Math.min(window.innerWidth, rect.right) &&
          releasePoint.y >= Math.max(0, rect.top) &&
          releasePoint.y <= Math.min(window.innerHeight, rect.bottom));
        const location = resolveDiaryDragRelease(
          event.canceled, insideDay, diaryTargetRef.current, directLocation);
        cancelPendingDiaryProjection();
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
        if (!event.canceled && drop && drop.position !== 'note' &&
            categoryIds.includes(drop.categoryId) && props.onMoveSharedTask) {
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
      const noteWrites = new Map<string, unknown>();
      if (session.mixedProjection) {
        for (const [id, position] of Object.entries(session.mixedProjection.notes)) {
          const key = diaryNotePositionKey(id);
          if (JSON.stringify(resolveDiaryNotePosition(getSetting(key))) !== JSON.stringify(position))
            noteWrites.set(key, position);
        }
      }
      if (!groups.length && !diaryChanged && !noteWrites.size) return;

      const commitId = ++commitIdRef.current;
      if (groups.length) setCommittedPlacement({ id: commitId, placement: finalPlacement });
      if (diaryChanged && nextDiary) setCommittedDiaryPlacement(nextDiary);
      if (noteWrites.size) setCommittedNoteOverrides(current => {
        const next = new Map([...current].filter(([key, item]) =>
          JSON.stringify(getSetting(key)) === JSON.stringify(item.baseline)));
        for (const [key, value] of noteWrites)
          next.set(key, { value, baseline: getSetting(key) });
        return next;
      });
      void Promise.resolve()
        .then(() => groups.length ? onReorderTasks(dateStr, groups) : undefined)
        .then(async () => {
          for (const [key, value] of noteWrites) await setSetting?.(key, value);
        })
        .then(() => diaryChanged && nextDiary ? props.onMoveDiary?.(nextDiary) : undefined)
        .catch(() => {
          setCommittedPlacement(current =>
            current && current.id >= commitId ? null : current
          );
          if (diaryChanged) setCommittedDiaryPlacement(null);
          if (noteWrites.size) setCommittedNoteOverrides(current => {
            const next = new Map(current);
            for (const key of noteWrites.keys()) next.delete(key);
            return next;
          });
        });
    },
    [
      cancelPendingDiaryProjection,
      categoryIds,
      dateStr,
      displayPlacement,
      livePlacement,
      onReorderActiveChange,
      endManualOverlay,
      onReorderTasks,
      taskSortMode,
      tasks,
      props,
      getSetting, setSetting,
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

  const overlayContents = (
    <>
        {activeSharedDrag && (
          <SharedTaskDragOverlay item={activeSharedDrag}
            color={categoryById.get(props.sharedCategoryFor?.(activeSharedDrag) || '')?.color || '#6B7280'} />
        )}
        {activeDiaryOverlay && (activeDiaryOverlay.visual
          ? <DiaryGroupDragVisual snapshot={activeDiaryOverlay.visual}/>
          : <div aria-hidden="true" data-diary-drag-overlay="true"
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

    </>
  );

  return (
    <DragDropProvider
      plugins={PROBE_DRAG_PLUGINS}
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
        diaryNoteRuntimeOverrides={currentNoteOverrides}
        activeSharedDragId={activeSharedDrag?.id ?? null}
        activeDrag={activeDrag}
        diaryDragging={diaryDragging}
        diaryReleaseRevision={diaryReleaseRevision}
        diarySettling={diarySettling}
        settlingTaskId={settlingTaskId}
        lastReleasedTask={lastReleasedTask}
        diaryProjectedPlacement={diaryPreviewPlacement}
        diaryDragHeight={diaryDragHeight}
        diaryGroupSession={diaryGroupSession}
        onDiaryGroupSessionChange={setDiaryGroupSession}
      />
      </LayoutGroup>
      {USE_MANUAL_OVERLAY ? (
        overlayAnchor && typeof document !== 'undefined'
          ? createPortal(
            <div ref={canvasRef} data-mosaic-manual-drag-overlay="true"
              style={{
                position: 'fixed',
                left: overlayAnchor.left,
                top: overlayAnchor.top,
                width: overlayAnchor.width,
                zIndex: 2400,
                pointerEvents: 'none',
                willChange: 'transform',
                transform: 'translate3d(var(--mosaic-drag-x, 0px), var(--mosaic-drag-y, 0px), 0)',
              }}>
              <DragOverlay dropAnimation={null}>{overlayContents}</DragOverlay>
            </div>, document.body,
          ) : null
      ) : (
        <DragOverlay dropAnimation={null}>{overlayContents}</DragOverlay>
      )}
    </DragDropProvider>
  );
};
