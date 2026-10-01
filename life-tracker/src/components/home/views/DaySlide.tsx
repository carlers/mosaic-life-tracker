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

type DragSession = {
  pointerId: number;
  pointerType: string;
  taskId: string;
  sourceCategoryId: string;
  snapshot: readonly TaskDocument[];
  projected: readonly TaskDocument[];
  targetCategoryId: string;
  rowHeight: number;
  x: number;
  y: number;
};

type PendingProjection = {
  taskId: string;
  tasks: readonly TaskDocument[];
  signature: string;
};

const orderingSignature = (items: readonly TaskDocument[]) => {
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
  const autoScrollFrame = React.useRef<number | null>(null);
  const runAutoScrollRef = React.useRef<() => void>(() => undefined);
  const liveOrderingSignature = orderingSignature(tasks);
  const [syncedLiveOrderingSignature, setSyncedLiveOrderingSignature] = React.useState(liveOrderingSignature);

  if (liveOrderingSignature !== syncedLiveOrderingSignature) {
    setSyncedLiveOrderingSignature(liveOrderingSignature);
    if (pendingProjection) {
      const expectedIds = new Set(pendingProjection.tasks.map((task) => task.id));
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
    const projectedIds = new Set(pendingProjection.tasks.map((task) => task.id));
    const projected = pendingProjection.tasks.map((task) => {
      const latest = latestById.get(task.id);
      return latest ? { ...latest, categoryId: task.categoryId } : task;
    });
    for (const task of tasks) {
      if (!projectedIds.has(task.id)) projected.push(task);
    }
    return projected;
  }, [pendingProjection, tasks]);
  const displayedTasksRef = React.useRef(displayedTasks);
  React.useEffect(() => {
    displayedTasksRef.current = displayedTasks;
  }, [displayedTasks]);

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
    const dragged = finalSession.snapshot.find((task) => task.id === finalSession.taskId);
    const stillExists = tasksRef.current.some((task) => task.id === finalSession.taskId);
    if (
      cancelled ||
      !dragged ||
      !stillExists ||
      orderingSignature(finalSession.projected) === orderingSignature(finalSession.snapshot)
    ) {
      return;
    }

    const frozen = finalSession.projected.map((task) => Object.freeze({ ...task }));
    const optimistic: PendingProjection = {
      taskId: finalSession.taskId,
      tasks: frozen,
      signature: orderingSignature(frozen),
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
    if (!current) return;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const categoryId = hit?.closest<HTMLElement>('[data-category-id]')?.dataset.categoryId;
    if (!categoryId) return;

    const without = current.projected.filter((task) => task.id !== current.taskId);
    const categoryTasks = without.filter((task) => task.categoryId === categoryId);
    const placeholder = hit?.closest<HTMLElement>('[data-task-drop-index]');
    const placeholderIndex = Number(placeholder?.dataset.taskDropIndex);
    const targetElement = hit?.closest<HTMLElement>('[data-task-id]:not([data-reorder-anchor="true"])');
    const targetId = targetElement?.dataset.taskId;

    let localInsertAt = categoryTasks.length;
    if (placeholder && Number.isInteger(placeholderIndex)) {
      localInsertAt = Math.max(0, Math.min(placeholderIndex, categoryTasks.length));
    } else if (targetId && targetId !== current.taskId) {
      const targetIndex = categoryTasks.findIndex((task) => task.id === targetId);
      if (targetIndex >= 0) {
        const rect = targetElement!.getBoundingClientRect();
        localInsertAt = targetIndex + (y >= rect.top + rect.height / 2 ? 1 : 0);
      }
    }

    const categoryIndices = without
      .map((task, index) => task.categoryId === categoryId ? index : -1)
      .filter((index) => index >= 0);
    let insertAt = without.length;
    if (categoryIndices.length > 0) {
      insertAt = localInsertAt < categoryIndices.length
        ? categoryIndices[localInsertAt]
        : categoryIndices[categoryIndices.length - 1] + 1;
    }

    const original = current.snapshot.find((task) => task.id === current.taskId);
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
    if (velocity) scroller.scrollTop += velocity;
    autoScrollFrame.current = requestAnimationFrame(() => runAutoScrollRef.current());
  }, [scrollMode]);
  React.useEffect(() => { runAutoScrollRef.current = runAutoScroll; }, [runAutoScroll]);

  const activate = React.useCallback((task: TaskDocument, pointerId: number, pointerType: string, x: number, y: number) => {
    if (sessionRef.current || !reorderEnabled) return;
    const snapshot = displayedTasksRef.current.map((item) => Object.freeze({ ...item }));
    const row = surfaceRef.current?.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);
    const next: DragSession = {
      pointerId,
      pointerType,
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
  }, [onReorderActiveChange, reorderEnabled, runAutoScroll]);

  React.useEffect(() => {
    if (!reorderEnabled) return;
    const move = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (!current || event.pointerId !== current.pointerId || current.pointerType === 'touch') return;
      event.preventDefault();
      event.stopPropagation();
      projectAt(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (!current || event.pointerId !== current.pointerId || current.pointerType === 'touch') return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    const cancel = (event: PointerEvent) => {
      const current = sessionRef.current;
      if (!current || event.pointerId !== current.pointerId || current.pointerType === 'touch') return;
      finish(true);
    };
    const touchMove = (event: TouchEvent) => {
      if (sessionRef.current?.pointerType !== 'touch') return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      event.stopPropagation();
      projectAt(touch.clientX, touch.clientY);
    };
    const touchEnd = (event: TouchEvent) => {
      if (sessionRef.current?.pointerType !== 'touch' || event.touches.length > 0) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    const touchCancel = () => {
      if (sessionRef.current?.pointerType === 'touch') finish(true);
    };
    window.addEventListener('pointermove', move, { capture: true, passive: false });
    window.addEventListener('pointerup', up, { capture: true, passive: false });
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    window.addEventListener('touchend', touchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', touchCancel, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('touchend', touchEnd, true);
      window.removeEventListener('touchcancel', touchCancel, true);
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
    const targetTasks = session.projected.filter((task) => task.categoryId === session.targetCategoryId);
    const index = targetTasks.findIndex((task) => task.id === session.taskId);
    return index < 0 ? null : { categoryId: session.targetCategoryId, index };
  }, [session]);
  const draggedTask = session?.snapshot.find((task) => task.id === session.taskId);
  const draggedCategory = categories.find((category) => category.id === draggedTask?.categoryId);
  const tasksByCategory = React.useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    const source = session?.snapshot ?? displayedTasks;
    for (const task of source) {
      map.set(task.categoryId, [...(map.get(task.categoryId) ?? []), task]);
    }
    return map;
  }, [displayedTasks, session?.snapshot]);

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
