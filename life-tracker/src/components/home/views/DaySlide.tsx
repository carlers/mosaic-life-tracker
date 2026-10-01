import React from 'react';
import { CategorySection } from './CategorySection';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

interface DaySlideProps {
  date: Date;
  scrollMode?: 'page' | 'contained';
  dateStr: string;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  currentUserId: string;
  editingTaskId: string | null;
  editValue: string;
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string, categoryId: string, dateStr: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument, mode: 'view' | 'edit') => void;
  onEditTask: (task: TaskDocument) => void;
  onViewImage: (task: TaskDocument) => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  disableTaskLayoutAnimation?: boolean;
  continueAddingTasks?: boolean;
  showCategoryCollapseButton?: boolean;
  selectionMode?: boolean;
  selectedTaskIds?: ReadonlySet<string>;
  onToggleTaskSelection?: (taskId: string) => void;
  reorderEnabled?: boolean;
  onReorderTask?: (task: TaskDocument, targetCategoryId: string, ordering: TaskDocument[]) => Promise<unknown>;
  onReorderActiveChange?: (active: boolean) => void;
}

type TaskPlacement = Pick<TaskDocument, 'id' | 'categoryId'>;

type DragSession = {
  pointerId: number;
  pointerType: string;
  touchIdentifier: number | null;
  taskId: string;
  sourceCategoryId: string;
  snapshot: readonly TaskPlacement[];
  projected: readonly TaskPlacement[];
  targetCategoryId: string;
  rowHeight: number;
  x: number;
  y: number;
};

type PendingProjection = {
  taskId: string;
  placements: readonly TaskPlacement[];
  signature: string;
};

const orderingSignature = (items: readonly TaskPlacement[]) => {
  const grouped = new Map<string, string[]>();
  for (const task of items) {
    grouped.set(task.categoryId, [...(grouped.get(task.categoryId) ?? []), task.id]);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoryId, ids]) => `${categoryId}:${ids.join(',')}`)
    .join('|');
};

const DaySlideComponent: React.FC<DaySlideProps> = ({
  dateStr, scrollMode = 'page', tasks, categories, currentUserId, editingTaskId, editValue,
  onToggleTask, onAddTask, onOpenActions, onOpenMemo, onEditTask, onViewImage,
  onEditChange, onEditSave, onEditCancel, disableTaskLayoutAnimation = false,
  continueAddingTasks = false, showCategoryCollapseButton = false, selectionMode = false,
  selectedTaskIds = new Set<string>(), onToggleTaskSelection, reorderEnabled = false,
  onReorderTask, onReorderActiveChange,
}) => {
  const [session, setSession] = React.useState<DragSession | null>(null);
  const [pendingProjection, setPendingProjection] = React.useState<PendingProjection | null>(null);
  const sessionRef = React.useRef<DragSession | null>(null);
  const tasksRef = React.useRef(tasks);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const activeTouchesRef = React.useRef(new Map<number, { x: number; y: number }>());
  const autoScrollFrame = React.useRef<number | null>(null);
  const runAutoScrollRef = React.useRef<() => void>(() => undefined);
  const liveOrderingSignature = orderingSignature(tasks);
  const [syncedLiveOrderingSignature, setSyncedLiveOrderingSignature] = React.useState(liveOrderingSignature);

  if (liveOrderingSignature !== syncedLiveOrderingSignature) {
    setSyncedLiveOrderingSignature(liveOrderingSignature);
    if (pendingProjection) {
      const expectedIds = new Set(pendingProjection.placements.map((task) => task.id));
      const liveExpected = tasks.filter((task) => expectedIds.has(task.id));
      if (
        liveExpected.length !== expectedIds.size ||
        orderingSignature(liveExpected) === pendingProjection.signature
      ) {
        setPendingProjection(null);
      }
    }
  }

  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const displayedTasks = React.useMemo(() => {
    if (!pendingProjection) return tasks;
    const latestById = new Map(tasks.map((task) => [task.id, task]));
    const projectedIds = new Set(pendingProjection.placements.map((placement) => placement.id));
    const projected = pendingProjection.placements.flatMap((placement) => {
      const latest = latestById.get(placement.id);
      return latest ? [{ ...latest, categoryId: placement.categoryId }] : [];
    });
    for (const task of tasks) {
      if (!projectedIds.has(task.id)) projected.push(task);
    }
    return projected;
  }, [pendingProjection, tasks]);

  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollFrame.current !== null) cancelAnimationFrame(autoScrollFrame.current);
    autoScrollFrame.current = null;
  }, []);

  const finish = React.useCallback((cancelled: boolean) => {
    const finalSession = sessionRef.current;
    if (!finalSession) return;
    sessionRef.current = null;
    setSession(null);
    stopAutoScroll();
    onReorderActiveChange?.(false);

    const latestById = new Map(tasksRef.current.map((task) => [task.id, task]));
    const dragged = latestById.get(finalSession.taskId);
    if (
      cancelled ||
      !dragged ||
      orderingSignature(finalSession.projected) === orderingSignature(finalSession.snapshot)
    ) {
      return;
    }

    const placements = finalSession.projected
      .filter((placement) => latestById.has(placement.id))
      .map((placement) => Object.freeze({ ...placement }));
    const frozen = placements.flatMap((placement) => {
      const latest = latestById.get(placement.id);
      return latest ? [Object.freeze({ ...latest, categoryId: placement.categoryId })] : [];
    });
    const optimistic: PendingProjection = {
      taskId: finalSession.taskId,
      placements,
      signature: orderingSignature(placements),
    };
    setPendingProjection(optimistic);

    if (!onReorderTask) {
      setPendingProjection(null);
      return;
    }
    void Promise.resolve(onReorderTask(dragged, finalSession.targetCategoryId, frozen)).catch(() => {
      setPendingProjection((current) =>
        current?.signature === optimistic.signature ? null : current
      );
    });
  }, [onReorderActiveChange, onReorderTask, stopAutoScroll]);

  const projectAt = React.useCallback((x: number, y: number) => {
    const current = sessionRef.current;
    const surface = surfaceRef.current;
    if (!current || !surface) return;

    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    let category = hit?.closest<HTMLElement>('[data-category-id]') ?? null;
    if (!category || !surface.contains(category)) {
      category = [...surface.querySelectorAll<HTMLElement>('[data-category-id]')].find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right;
      }) ?? null;
    }
    const categoryId = category?.dataset.categoryId;
    if (!category || !categoryId) return;

    const without = current.projected.filter((placement) => placement.id !== current.taskId);
    const categoryTasks = without.filter((placement) => placement.categoryId === categoryId);
    const rows = [...category.querySelectorAll<HTMLElement>(
      '[data-task-id]:not([data-reorder-anchor="true"])'
    )];

    let localInsertAt = rows.length;
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        localInsertAt = index;
        break;
      }
    }
    localInsertAt = Math.max(0, Math.min(localInsertAt, categoryTasks.length));

    const categoryIndices = without
      .map((placement, index) => placement.categoryId === categoryId ? index : -1)
      .filter((index) => index >= 0);
    let insertAt = without.length;
    if (categoryIndices.length > 0) {
      insertAt = localInsertAt < categoryIndices.length
        ? categoryIndices[localInsertAt]
        : categoryIndices[categoryIndices.length - 1] + 1;
    }

    const original = current.snapshot.find((placement) => placement.id === current.taskId);
    if (!original) return;
    const projected = [...without];
    projected.splice(insertAt, 0, { ...original, categoryId });
    const next = { ...current, x, y, targetCategoryId: categoryId, projected };
    sessionRef.current = next;
    setSession(next);
  }, []);

  const runAutoScroll = React.useCallback(() => {
    const current = sessionRef.current;
    const scroller = scrollMode === 'contained' ? surfaceRef.current : document.scrollingElement;
    if (!current || !scroller) { autoScrollFrame.current = null; return; }
    const bounds = scrollMode === 'contained' ? surfaceRef.current!.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const edge = 64;
    const velocity = current.y < bounds.top + edge ? -Math.min(14, (bounds.top + edge - current.y) / 4)
      : current.y > bounds.bottom - edge ? Math.min(14, (current.y - (bounds.bottom - edge)) / 4) : 0;
    if (velocity) scroller.scrollBy({ top: velocity });
    autoScrollFrame.current = requestAnimationFrame(() => runAutoScrollRef.current());
  }, [scrollMode]);
  React.useEffect(() => { runAutoScrollRef.current = runAutoScroll; }, [runAutoScroll]);

  const activate = React.useCallback((task: TaskDocument, pointerId: number, pointerType: string, x: number, y: number) => {
    if (sessionRef.current || !reorderEnabled) return;
    const snapshot = displayedTasks.map(({ id, categoryId }) => Object.freeze({ id, categoryId }));
    const row = surfaceRef.current?.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);

    let touchIdentifier: number | null = null;
    if (pointerType === 'touch' && activeTouchesRef.current.size > 0) {
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const [identifier, point] of activeTouchesRef.current) {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < closestDistance) {
          closestDistance = distance;
          touchIdentifier = identifier;
        }
      }
    }

    const next: DragSession = {
      pointerId,
      pointerType,
      touchIdentifier,
      taskId: task.id,
      sourceCategoryId: task.categoryId,
      snapshot,
      projected: snapshot,
      targetCategoryId: task.categoryId,
      rowHeight: Math.max(1, row?.getBoundingClientRect().height ?? 40),
      x,
      y,
    };
    sessionRef.current = next;
    setSession(next);
    onReorderActiveChange?.(true);
    autoScrollFrame.current = requestAnimationFrame(runAutoScroll);
  }, [displayedTasks, onReorderActiveChange, reorderEnabled, runAutoScroll]);

  React.useEffect(() => {
    if (!reorderEnabled) return;
    const activeTouches = activeTouchesRef.current;

    const rememberTouches = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        activeTouches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    };
    const forgetTouches = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        activeTouches.delete(touch.identifier);
      }
    };
    const move = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (!current || current.pointerType === 'touch' || event.pointerId !== current.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      projectAt(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (!current || current.pointerType === 'touch' || event.pointerId !== current.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    const cancel = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (!current || current.pointerType === 'touch' || event.pointerId !== current.pointerId) return;
      finish(true);
    };
    const touchMove = (event: TouchEvent) => {
      rememberTouches(event);
      const current = sessionRef.current;
      if (!current || current.pointerType !== 'touch') return;
      const touches = Array.from(event.touches);
      const touch = current.touchIdentifier === null
        ? touches[0]
        : touches.find((candidate) => candidate.identifier === current.touchIdentifier);
      if (!touch) return;

      if (current.touchIdentifier === null) {
        const next = { ...current, touchIdentifier: touch.identifier };
        sessionRef.current = next;
        setSession(next);
      }
      event.preventDefault();
      event.stopPropagation();
      projectAt(touch.clientX, touch.clientY);
    };
    const touchEnd = (event: TouchEvent) => {
      const current = sessionRef.current;
      const endedIds = new Set(Array.from(event.changedTouches, (touch) => touch.identifier));
      forgetTouches(event);
      if (!current || current.pointerType !== 'touch') return;
      if (current.touchIdentifier !== null && !endedIds.has(current.touchIdentifier)) return;
      if (current.touchIdentifier === null && event.touches.length > 0) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    const touchCancel = (event: TouchEvent) => {
      const current = sessionRef.current;
      const cancelledIds = new Set(Array.from(event.changedTouches, (touch) => touch.identifier));
      forgetTouches(event);
      if (!current || current.pointerType !== 'touch') return;
      if (current.touchIdentifier !== null && !cancelledIds.has(current.touchIdentifier)) return;
      finish(true);
    };

    window.addEventListener('touchstart', rememberTouches, { capture: true, passive: true });
    window.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    window.addEventListener('touchend', touchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', touchCancel, true);
    window.addEventListener('pointermove', move, { capture: true, passive: false });
    window.addEventListener('pointerup', up, { capture: true, passive: false });
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      activeTouches.clear();
      window.removeEventListener('touchstart', rememberTouches, true);
      window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('touchend', touchEnd, true);
      window.removeEventListener('touchcancel', touchCancel, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }, [finish, projectAt, reorderEnabled]);

  React.useEffect(() => () => finish(true), [dateStr, finish]);
  React.useEffect(() => { if (!reorderEnabled && sessionRef.current) finish(true); }, [finish, reorderEnabled]);
  React.useEffect(() => {
    const current = sessionRef.current;
    if (current && !tasks.some((task) => task.id === current.taskId)) finish(true);
  }, [finish, tasks]);
  const insertion = React.useMemo(() => {
    if (!session) return null;
    const targetTasks = session.projected.filter((placement) => placement.categoryId === session.targetCategoryId);
    const index = targetTasks.findIndex((placement) => placement.id === session.taskId);
    return index < 0 ? null : { categoryId: session.targetCategoryId, index };
  }, [session]);
  const draggedTask = session
    ? displayedTasks.find((task) => task.id === session.taskId) ?? null
    : null;
  const draggedCategory = categories.find((category) => category.id === session?.sourceCategoryId);
  const renderedTasks = React.useMemo(() => {
    if (!session) return displayedTasks;
    const latestById = new Map(displayedTasks.map((task) => [task.id, task]));
    const snapshotIds = new Set(session.snapshot.map((placement) => placement.id));
    const stable = session.snapshot.flatMap((placement) => {
      const latest = latestById.get(placement.id);
      return latest ? [{ ...latest, categoryId: placement.categoryId }] : [];
    });
    for (const task of displayedTasks) {
      if (!snapshotIds.has(task.id)) stable.push(task);
    }
    return stable;
  }, [displayedTasks, session]);
  const tasksByCategory = React.useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const task of renderedTasks) {
      map.set(task.categoryId, [...(map.get(task.categoryId) ?? []), task]);
    }
    return map;
  }, [renderedTasks]);

  if (categories.length === 0) return <div className="flex h-full flex-col items-center justify-center text-gray-400"><p className="text-sm">No categories yet</p></div>;

  return <div ref={surfaceRef} className={scrollMode === 'contained' ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-2 pb-8' : 'w-full min-w-0 px-4 pb-8'} data-testid="day-slide">
    {categories.map((cat) => <CategorySection key={cat.id} categoryName={cat.name} categoryId={cat.id} categoryColor={cat.color} visibility={cat.visibility} currentUserId={currentUserId}
      tasks={tasksByCategory.get(cat.id) ?? []} onToggleTask={onToggleTask} onAddTask={(title) => onAddTask(title, cat.id, dateStr)} onOpenActions={onOpenActions}
      onOpenMemo={onOpenMemo} onEditTask={onEditTask} onViewImage={onViewImage} editingTaskId={editingTaskId} editValue={editValue} onEditChange={onEditChange}
      onEditSave={onEditSave} onEditCancel={onEditCancel} disableTaskLayoutAnimation={disableTaskLayoutAnimation && !session} continueAddingAfterSubmit={continueAddingTasks}
      showCollapseButton={showCategoryCollapseButton} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleTaskSelection={onToggleTaskSelection}
      reorderEnabled={reorderEnabled && !selectionMode && !editingTaskId && !session} onReorderActivate={activate}
      draggedTaskId={session?.sourceCategoryId === cat.id ? session.taskId : null}
      insertionIndex={insertion?.categoryId === cat.id ? insertion.index : null}
      reorderPlaceholderHeight={session?.rowHeight} />)}
    {draggedTask && <div key={draggedTask.id} data-testid="task-drag-overlay" aria-hidden="true" className="pointer-events-none fixed z-[100] max-w-[min(24rem,80vw)] rounded-lg px-3 py-2 text-white shadow-2xl"
      style={{ left: session!.x, top: session!.y, transform: 'translate(-50%, -50%)', backgroundColor: `${draggedCategory?.color ?? '#374151'}ee` }}>{draggedTask.title}</div>}
  </div>;
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
