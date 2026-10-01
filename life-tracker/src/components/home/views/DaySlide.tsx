import React from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import { isSortable } from '@dnd-kit/react/sortable';
import { CategorySection } from './CategorySection';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import {
  buildTaskPlacement,
  cloneTaskPlacement,
  taskPlacementIdSignature,
  taskPlacementSignature,
  type TaskOrderGroup,
  type TaskPlacement,
} from '../../../lib/taskOrder';

const TASK_REORDER_POINTER_SENSOR = PointerSensor.configure({
  activationConstraints: [
    new PointerActivationConstraints.Delay({
      value: 500,
      tolerance: 8,
    }),
  ],
});

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
  onReorderTasks,
  onReorderActiveChange,
}) => {
  const categoryIds = React.useMemo(
    () => categories.map((category) => category.id),
    [categories]
  );
  const livePlacement = React.useMemo(
    () => buildTaskPlacement(tasks, categoryIds),
    [categoryIds, tasks]
  );
  const [pendingPlacement, setPendingPlacement] =
    React.useState<TaskPlacement | null>(null);
  const [dragPlacement, setDragPlacement] =
    React.useState<TaskPlacement | null>(null);
  const dragSnapshotRef = React.useRef<TaskPlacement | null>(null);
  const dragPlacementRef = React.useRef<TaskPlacement | null>(null);

  const livePlacementSignature = React.useMemo(
    () => taskPlacementSignature(livePlacement, categoryIds),
    [categoryIds, livePlacement]
  );
  const liveIdSignature = React.useMemo(
    () => taskPlacementIdSignature(livePlacement),
    [livePlacement]
  );
  const usablePendingPlacement =
    pendingPlacement &&
    taskPlacementIdSignature(pendingPlacement) === liveIdSignature &&
    taskPlacementSignature(pendingPlacement, categoryIds) !==
      livePlacementSignature
      ? pendingPlacement
      : null;
  const basePlacement = usablePendingPlacement ?? livePlacement;
  const effectivePlacement = dragPlacement ?? basePlacement;
  const taskById = React.useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );
  const tasksByCategory = React.useMemo(() => {
    const map = new Map<string, TaskDocument[]>();

    for (const categoryId of categoryIds) {
      const ordered = (effectivePlacement[categoryId] ?? []).flatMap(
        (taskId, order) => {
          const task = taskById.get(taskId);
          if (!task) return [];
          if (task.categoryId === categoryId && task.order === order) {
            return [task];
          }
          return [{ ...task, categoryId, order }];
        }
      );
      map.set(categoryId, ordered);
    }

    return map;
  }, [categoryIds, effectivePlacement, taskById]);

  const handleDragStart = React.useCallback(() => {
    const snapshot = cloneTaskPlacement(basePlacement);
    dragSnapshotRef.current = snapshot;
    dragPlacementRef.current = snapshot;
    setDragPlacement(snapshot);
    onReorderActiveChange?.(true);
  }, [basePlacement, onReorderActiveChange]);

  const handleDragOver = React.useCallback(
    (
      event: Parameters<
        NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragOver']>
      >[0]
    ) => {
      setDragPlacement((current) => {
        if (!current) return current;
        const next = move(current, event) as TaskPlacement;
        dragPlacementRef.current = next;
        return next;
      });
    },
    []
  );

  const handleDragEnd = React.useCallback(
    (
      event: Parameters<
        NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragEnd']>
      >[0]
    ) => {
      onReorderActiveChange?.(false);
      const snapshot = dragSnapshotRef.current;
      const finalPlacement = dragPlacementRef.current;
      dragSnapshotRef.current = null;
      dragPlacementRef.current = null;
      setDragPlacement(null);

      if (
        event.canceled ||
        !snapshot ||
        !finalPlacement ||
        !onReorderTasks
      ) {
        return;
      }

      const { source } = event.operation;
      if (!isSortable(source)) return;

      const taskId = String(source.id);
      const initialCategoryId = findTaskCategory(snapshot, taskId);
      const targetCategoryId = findTaskCategory(finalPlacement, taskId);
      if (!initialCategoryId || !targetCategoryId) return;

      const snapshotSignature = taskPlacementSignature(snapshot, categoryIds);
      const nextSignature = taskPlacementSignature(
        finalPlacement,
        categoryIds
      );
      if (snapshotSignature === nextSignature) return;

      setPendingPlacement(finalPlacement);
      const affectedCategoryIds = Array.from(
        new Set([initialCategoryId, targetCategoryId])
      );
      const groups: TaskOrderGroup[] = affectedCategoryIds.map(
        (categoryId) => ({
          categoryId,
          taskIds: finalPlacement[categoryId] ?? [],
        })
      );

      void Promise.resolve(onReorderTasks(dateStr, groups)).catch(() => {
        setPendingPlacement((current) =>
          current &&
          taskPlacementSignature(current, categoryIds) === nextSignature
            ? null
            : current
        );
      });
    },
    [categoryIds, dateStr, onReorderActiveChange, onReorderTasks]
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-sm">No categories yet</p>
      </div>
    );
  }

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
      <div
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
            categoryId={cat.id}
            categoryName={cat.name}
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
            reorderEnabled={reorderEnabled}
          />
        ))}
      </div>
    </DragDropProvider>
  );
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
