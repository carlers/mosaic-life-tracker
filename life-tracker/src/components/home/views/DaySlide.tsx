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
  taskId: string;
  snapshot: readonly TaskDocument[];
  projected: readonly TaskDocument[];
  targetCategoryId: string;
  x: number;
  y: number;
};

const signature = (items: readonly TaskDocument[]) => items.map((task) => `${task.id}:${task.categoryId}`).join('|');

const DaySlideComponent: React.FC<DaySlideProps> = ({
  dateStr, scrollMode = 'page', tasks, categories, currentUserId, editingTaskId, editValue,
  onToggleTask, onAddTask, onOpenActions, onOpenMemo, onEditTask, onViewImage,
  onEditChange, onEditSave, onEditCancel, disableTaskLayoutAnimation = false,
  continueAddingTasks = false, showCategoryCollapseButton = false, selectionMode = false,
  selectedTaskIds = new Set<string>(), onToggleTaskSelection, reorderEnabled = false,
  onReorderTask, onReorderActiveChange,
}) => {
  const [session, setSession] = React.useState<DragSession | null>(null);
  const sessionRef = React.useRef<DragSession | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const autoScrollFrame = React.useRef<number | null>(null);
  const runAutoScrollRef = React.useRef<() => void>(() => undefined);

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
    if (!cancelled && signature(finalSession.projected) !== signature(finalSession.snapshot)) {
      const dragged = finalSession.snapshot.find((task) => task.id === finalSession.taskId);
      if (dragged) {
        const frozen = finalSession.projected.map((task) => Object.freeze({ ...task }));
        void onReorderTask?.(dragged, finalSession.targetCategoryId, frozen).catch(() => undefined);
      }
    }
  }, [onReorderActiveChange, onReorderTask, stopAutoScroll]);

  const projectAt = React.useCallback((x: number, y: number) => {
    const current = sessionRef.current;
    if (!current) return;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const categoryId = hit?.closest<HTMLElement>('[data-category-id]')?.dataset.categoryId;
    if (!categoryId) return;
    const targetElement = hit?.closest<HTMLElement>('[data-task-id]');
    const targetId = targetElement?.dataset.taskId;
    const without = current.projected.filter((task) => task.id !== current.taskId);
    let insertAt = without.length;
    if (targetId && targetId !== current.taskId) {
      const targetIndex = without.findIndex((task) => task.id === targetId);
      if (targetIndex >= 0) {
        const rect = targetElement!.getBoundingClientRect();
        insertAt = targetIndex + (y >= rect.top + rect.height / 2 ? 1 : 0);
      }
    } else {
      const lastInCategory = without.reduce((last, task, index) => task.categoryId === categoryId ? index : last, -1);
      insertAt = lastInCategory + 1;
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

  const activate = React.useCallback((task: TaskDocument, pointerId: number, x: number, y: number) => {
    if (sessionRef.current || !reorderEnabled) return;
    const snapshot = tasks.map((item) => Object.freeze({ ...item }));
    const next: DragSession = { pointerId, taskId: task.id, snapshot, projected: snapshot, targetCategoryId: task.categoryId, x, y };
    sessionRef.current = next;
    setSession(next);
    onReorderActiveChange?.(true);
    autoScrollFrame.current = requestAnimationFrame(runAutoScroll);
  }, [onReorderActiveChange, reorderEnabled, runAutoScroll, tasks]);

  React.useEffect(() => {
    if (!session) return;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== sessionRef.current?.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      projectAt(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== sessionRef.current?.pointerId) return;
      event.preventDefault(); event.stopPropagation(); finish(false);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId !== sessionRef.current?.pointerId) return;
      finish(true);
    };
    window.addEventListener('pointermove', move, { capture: true, passive: false });
    window.addEventListener('pointerup', up, { capture: true, passive: false });
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }, [finish, projectAt, session?.pointerId]);

  React.useEffect(() => () => finish(true), [dateStr, finish]);
  React.useEffect(() => { if (!reorderEnabled && sessionRef.current) finish(true); }, [finish, reorderEnabled]);

  const insertion = React.useMemo(() => {
    if (!session) return null;
    const categoryTasks = session.projected.filter((task) => task.categoryId === session.targetCategoryId && task.id !== session.taskId);
    const projectedIndex = session.projected.filter((task) => task.categoryId === session.targetCategoryId).findIndex((task) => task.id === session.taskId);
    return { categoryId: session.targetCategoryId, index: Math.max(0, Math.min(projectedIndex, categoryTasks.length)) };
  }, [session]);
  const draggedTask = session?.snapshot.find((task) => task.id === session.taskId);
  const draggedCategory = categories.find((category) => category.id === draggedTask?.categoryId);
  const tasksByCategory = React.useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const task of tasks) map.set(task.categoryId, [...(map.get(task.categoryId) ?? []), task]);
    return map;
  }, [tasks]);

  if (categories.length === 0) return <div className="flex h-full flex-col items-center justify-center text-gray-400"><p className="text-sm">No categories yet</p></div>;

  return <div ref={surfaceRef} className={scrollMode === 'contained' ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-2 pb-8' : 'w-full min-w-0 px-4 pb-8'} data-testid="day-slide">
    {categories.map((cat) => <CategorySection key={cat.id} categoryName={cat.name} categoryId={cat.id} categoryColor={cat.color} visibility={cat.visibility} currentUserId={currentUserId}
      tasks={tasksByCategory.get(cat.id) ?? []} onToggleTask={onToggleTask} onAddTask={(title) => onAddTask(title, cat.id, dateStr)} onOpenActions={onOpenActions}
      onOpenMemo={onOpenMemo} onEditTask={onEditTask} onViewImage={onViewImage} editingTaskId={editingTaskId} editValue={editValue} onEditChange={onEditChange}
      onEditSave={onEditSave} onEditCancel={onEditCancel} disableTaskLayoutAnimation={disableTaskLayoutAnimation} continueAddingAfterSubmit={continueAddingTasks}
      showCollapseButton={showCategoryCollapseButton} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleTaskSelection={onToggleTaskSelection}
      reorderEnabled={reorderEnabled && !selectionMode && !editingTaskId && !session} onReorderActivate={activate} draggedTaskId={session?.taskId}
      insertionIndex={insertion?.categoryId === cat.id ? insertion.index : null} />)}
    {draggedTask && <div key={draggedTask.id} data-testid="task-drag-overlay" aria-hidden="true" className="pointer-events-none fixed z-[100] max-w-[min(24rem,80vw)] rounded-lg px-3 py-2 text-white shadow-2xl"
      style={{ left: session!.x, top: session!.y, transform: 'translate(-50%, -50%)', backgroundColor: `${draggedCategory?.color ?? '#374151'}ee` }}>{draggedTask.title}</div>}
  </div>;
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
