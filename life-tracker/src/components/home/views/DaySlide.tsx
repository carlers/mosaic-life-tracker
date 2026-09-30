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
}

const DaySlideComponent: React.FC<DaySlideProps> = ({
  dateStr,
  scrollMode = 'page',
  tasks,
  categories,
  currentUserId,
  editingTaskId,
  editValue,
  onToggleTask,
  onAddTask,
  onOpenActions,
  onOpenMemo,
  onEditTask,
  onViewImage,
  onEditChange,
  onEditSave,
  onEditCancel,
  disableTaskLayoutAnimation = false,
  continueAddingTasks = false,
  showCategoryCollapseButton = false,
  selectionMode = false,
  selectedTaskIds = new Set<string>(),
  onToggleTaskSelection,
  reorderEnabled = false,
  onReorderTask,
}) => {
  const [dragTasks, setDragTasks] = React.useState<TaskDocument[] | null>(null);
  const dragSnapshot = React.useRef<TaskDocument[] | null>(null);
  const targetCategory = React.useRef<string | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const autoScrollFrame = React.useRef<number | null>(null);
  const pointerY = React.useRef<number | null>(null);
  const runAutoScrollRef = React.useRef<(() => void) | null>(null);
  const renderedTasks = dragTasks ?? tasks;
  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollFrame.current !== null) cancelAnimationFrame(autoScrollFrame.current);
    autoScrollFrame.current = null;
    pointerY.current = null;
  }, []);
  React.useEffect(() => () => {
    dragSnapshot.current = null;
    stopAutoScroll();
  }, [stopAutoScroll]);

  const runAutoScroll = React.useCallback(() => {
    const scroller = scrollMode === 'contained'
      ? surfaceRef.current
      : document.scrollingElement;
    const y = pointerY.current;
    if (!scroller || y === null) {
      autoScrollFrame.current = null;
      return;
    }
    const bounds = scrollMode === 'contained'
      ? surfaceRef.current!.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const edge = 64;
    const velocity = y < bounds.top + edge
      ? -Math.min(14, (bounds.top + edge - y) / 4)
      : y > bounds.bottom - edge
        ? Math.min(14, (y - (bounds.bottom - edge)) / 4)
        : 0;
    if (velocity) scroller.scrollTop += velocity;
    autoScrollFrame.current = requestAnimationFrame(() => runAutoScrollRef.current?.());
  }, [scrollMode]);
  React.useEffect(() => {
    runAutoScrollRef.current = runAutoScroll;
  }, [runAutoScroll]);

  const handleReorderStart = React.useCallback(() => {
    dragSnapshot.current = tasks.map((task) => ({ ...task }));
    setDragTasks(dragSnapshot.current);
  }, [tasks]);
  const handleReorderMove = React.useCallback((dragged: TaskDocument, x: number, y: number) => {
    pointerY.current = y;
    if (autoScrollFrame.current === null) autoScrollFrame.current = requestAnimationFrame(() => runAutoScrollRef.current?.());
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    const categoryElement = element?.closest<HTMLElement>('[data-category-id]');
    const categoryId = categoryElement?.dataset.categoryId;
    if (!categoryId) return;
    const targetId = element?.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    setDragTasks((current) => {
      if (!current) return current;
      const without = current.filter((task) => task.id !== dragged.id);
      const moved = { ...dragged, categoryId };
      const targetIndex = targetId ? without.findIndex((task) => task.id === targetId) : -1;
      const insertAt = targetIndex >= 0
        ? targetIndex
        : without.reduce((last, task, index) => task.categoryId === categoryId ? index + 1 : last, 0);
      const next = [...without];
      next.splice(insertAt, 0, moved);
      if (current.map((task) => `${task.id}:${task.categoryId}`).join('|') === next.map((task) => `${task.id}:${task.categoryId}`).join('|')) return current;
      targetCategory.current = categoryId;
      return next;
    });
  }, []);
  const handleReorderEnd = React.useCallback((dragged: TaskDocument, cancelled: boolean) => {
    setDragTasks((current) => {
      const original = dragSnapshot.current;
      dragSnapshot.current = null;
      if (!cancelled && current && original && current.map((task) => `${task.id}:${task.categoryId}`).join('|') !== original.map((task) => `${task.id}:${task.categoryId}`).join('|')) {
        void onReorderTask?.(dragged, targetCategory.current ?? dragged.categoryId, current).catch(() => undefined);
      }
      return null;
    });
    stopAutoScroll();
  }, [onReorderTask, stopAutoScroll]);

  const tasksByCategory = React.useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const task of renderedTasks) {
      const list = map.get(task.categoryId);
      if (list) {
        list.push(task);
      } else {
        map.set(task.categoryId, [task]);
      }
    }
    return map;
  }, [renderedTasks]);

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-sm">No categories yet</p>
      </div>
    );
  }

  return (
    <div
      ref={surfaceRef}
      className={
        scrollMode === 'contained'
          ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-2 pb-8'
          : 'w-full min-w-0 px-4 pb-8'
      }
      data-testid="day-slide"
    >
      {categories.map((cat) => (
        <CategorySection
          key={cat.id}
          categoryName={cat.name}
          categoryId={cat.id}
          categoryColor={cat.color}
          visibility={cat.visibility}
          currentUserId={currentUserId}
          tasks={tasksByCategory.get(cat.id) ?? []}
          onToggleTask={onToggleTask}
          onAddTask={(title) => onAddTask(title, cat.id, dateStr)}
          onOpenActions={onOpenActions}
          onOpenMemo={onOpenMemo}
          onEditTask={onEditTask}
          onViewImage={onViewImage}
          editingTaskId={editingTaskId}
          editValue={editValue}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          disableTaskLayoutAnimation={disableTaskLayoutAnimation}
          continueAddingAfterSubmit={continueAddingTasks}
          showCollapseButton={showCategoryCollapseButton}
          selectionMode={selectionMode}
          selectedTaskIds={selectedTaskIds}
          onToggleTaskSelection={onToggleTaskSelection}
          reorderEnabled={reorderEnabled && !selectionMode && !editingTaskId}
          onReorderStart={handleReorderStart}
          onReorderMove={handleReorderMove}
          onReorderEnd={handleReorderEnd}
        />
      ))}
    </div>
  );
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
