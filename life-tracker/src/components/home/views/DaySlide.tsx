import React from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import { CategorySection } from './CategorySection';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import {
  buildTaskPlacement,
  cloneTaskPlacement,
  moveTaskInPlacement,
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

const CATEGORY_DROP_PREFIX = 'task-category:';

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
  onReorderTasks?: (
    dateStr: string,
    groups: readonly TaskOrderGroup[]
  ) => Promise<void> | void;
  onReorderActiveChange?: (active: boolean) => void;
}

function categoryFromDropTarget(
  target: { id: string | number; type?: string | number | symbol } | null
): string | null {
  if (
    !target ||
    target.type !== 'task-category' ||
    typeof target.id !== 'string' ||
    !target.id.startsWith(CATEGORY_DROP_PREFIX)
  ) {
    return null;
  }
  return target.id.slice(CATEGORY_DROP_PREFIX.length);
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
  const dragSnapshotRef = React.useRef<TaskPlacement | null>(null);

  const livePlacementSignature = React.useMemo(
    () => taskPlacementSignature(livePlacement, categoryIds),
    [categoryIds, livePlacement]
  );
  const liveIdSignature = React.useMemo(
    () => taskPlacementIdSignature(livePlacement),
    [livePlacement]
  );

  React.useEffect(() => {
    if (!pendingPlacement) return;
    const pendingIdSignature = taskPlacementIdSignature(pendingPlacement);
    const pendingSignature = taskPlacementSignature(
      pendingPlacement,
      categoryIds
    );

    if (
      pendingIdSignature !== liveIdSignature ||
      pendingSignature === livePlacementSignature
    ) {
      setPendingPlacement(null);
    }
  }, [
    categoryIds,
    liveIdSignature,
    livePlacementSignature,
    pendingPlacement,
  ]);

  const effectivePlacement = pendingPlacement ?? livePlacement;
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
    dragSnapshotRef.current = cloneTaskPlacement(effectivePlacement);
    onReorderActiveChange?.(true);
  }, [effectivePlacement, onReorderActiveChange]);

  const handleDragEnd = React.useCallback(
    (
      event: Parameters<
        NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragEnd']>
      >[0]
    ) => {
      onReorderActiveChange?.(false);
      const snapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;

      if (event.canceled || !snapshot || !onReorderTasks) return;

      const { source, target } = event.operation;
      if (!isSortable(source) || source.initialGroup == null) return;

      const initialCategoryId = String(source.initialGroup);
      const categoryTarget = categoryFromDropTarget(target);
      const targetCategoryId =
        categoryTarget ??
        (source.group == null ? initialCategoryId : String(source.group));
      const targetIndex =
        categoryTarget !== null
          ? (snapshot[targetCategoryId] ?? []).length
          : source.index;

      const nextPlacement = moveTaskInPlacement(
        snapshot,
        String(source.id),
        targetCategoryId,
        targetIndex
      );
      if (!nextPlacement) return;

      const snapshotSignature = taskPlacementSignature(snapshot, categoryIds);
      const nextSignature = taskPlacementSignature(nextPlacement, categoryIds);
      if (snapshotSignature === nextSignature) return;

      setPendingPlacement(nextPlacement);
      const affectedCategoryIds = Array.from(
        new Set([initialCategoryId, targetCategoryId])
      );
      const groups: TaskOrderGroup[] = affectedCategoryIds.map(
        (categoryId) => ({
          categoryId,
          taskIds: nextPlacement[categoryId] ?? [],
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
