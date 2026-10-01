import React from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { move } from '@dnd-kit/helpers';
import { isSortable } from '@dnd-kit/react/sortable';
import { CategorySection } from './CategorySection';
import { TaskItem } from './TaskItem';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import {
  buildTaskPlacement,
  cloneTaskPlacement,
  isTaskPlacementCompatible,
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

interface CommittedPlacement {
  id: number;
  placement: TaskPlacement;
  signature: string;
}

interface ActiveDrag {
  taskId: string;
  initialCategoryId: string;
  snapshot: TaskPlacement;
  projection: TaskPlacement;
  rowHeight: number;
}

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
  reorderRuntimeActive?: boolean;
  onReorderTasks?: (
    dateStr: string,
    groups: readonly TaskOrderGroup[]
  ) => Promise<void> | void;
  onReorderActiveChange?: (active: boolean) => void;
}

interface DaySlideContentProps extends DaySlideProps {
  tasksByCategory: Map<string, TaskDocument[]>;
  activeDrag: ActiveDrag | null;
}

function findTaskCategory(
  placement: TaskPlacement,
  taskId: string
): string | null {
  for (const [categoryId, taskIds] of Object.entries(placement)) {
    if (taskIds.includes(taskId)) return categoryId;
  }
  return null;
}

function buildRenderedTasksByCategory(
  tasks: readonly TaskDocument[],
  placement: TaskPlacement,
  categoryIds: readonly string[]
): Map<string, TaskDocument[]> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const result = new Map<string, TaskDocument[]>();

  for (const categoryId of categoryIds) {
    const ordered = (placement[categoryId] ?? []).flatMap(
      (taskId, order) => {
        const task = taskById.get(taskId);
        if (!task) return [];
        if (task.categoryId === categoryId && task.order === order) {
          return [task];
        }
        return [{ ...task, categoryId, order }];
      }
    );
    result.set(categoryId, ordered);
  }

  return result;
}

const DaySlideContent: React.FC<DaySlideContentProps> = ({
  dateStr,
  scrollMode = 'page',
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
  tasksByCategory,
  activeDrag,
}) => {
  const projectedCategoryId = activeDrag
    ? findTaskCategory(activeDrag.projection, activeDrag.taskId)
    : null;
  const projectedGapIndex =
    activeDrag && projectedCategoryId
      ? activeDrag.projection[projectedCategoryId]?.indexOf(activeDrag.taskId) ??
        null
      : null;

  return (
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
          activeDragTaskId={
            activeDrag?.initialCategoryId === cat.id
              ? activeDrag.taskId
              : null
          }
          dragGapIndex={
            projectedCategoryId === cat.id ? projectedGapIndex : null
          }
          dragGapHeight={activeDrag?.rowHeight ?? 0}
        />
      ))}
    </div>
  );
};

const TaskReorderRuntime: React.FC<
  DaySlideProps & {
    categoryIds: string[];
    livePlacement: TaskPlacement;
  }
> = (props) => {
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
  const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null);
  const dragSnapshotRef = React.useRef<TaskPlacement | null>(null);
  const dragProjectionRef = React.useRef<TaskPlacement | null>(null);
  const commitIdRef = React.useRef(0);

  const livePlacementSignature = React.useMemo(
    () => taskPlacementSignature(livePlacement, categoryIds),
    [categoryIds, livePlacement]
  );

  const committedIsCompatible =
    committedPlacement !== null &&
    isTaskPlacementCompatible(
      committedPlacement.placement,
      livePlacement,
      categoryIds
    );
  const committedMatchesLive =
    committedPlacement?.signature === livePlacementSignature;
  const activeCommittedPlacement =
    committedPlacement && committedIsCompatible && !committedMatchesLive
      ? committedPlacement.placement
      : null;
  const basePlacement = activeCommittedPlacement ?? livePlacement;
  const renderPlacement = activeDrag?.snapshot ?? basePlacement;

  React.useEffect(() => {
    if (!committedPlacement) return;
    if (committedIsCompatible && !committedMatchesLive) return;

    const retiringId = committedPlacement.id;
    setCommittedPlacement((current) =>
      current?.id === retiringId ? null : current
    );
  }, [
    committedIsCompatible,
    committedMatchesLive,
    committedPlacement,
  ]);

  React.useEffect(
    () => () => {
      dragSnapshotRef.current = null;
      dragProjectionRef.current = null;
      onReorderActiveChange?.(false);
    },
    [onReorderActiveChange]
  );

  const tasksByCategory = React.useMemo(
    () =>
      buildRenderedTasksByCategory(
        tasks,
        renderPlacement,
        categoryIds
      ),
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
      if (!isSortable(source)) return;

      const taskId = String(source.id);
      const snapshot = cloneTaskPlacement(basePlacement);
      const initialCategoryId = findTaskCategory(snapshot, taskId);
      if (!initialCategoryId) return;

      const rowHeight = Math.max(
        1,
        source.element?.getBoundingClientRect().height ?? 1
      );
      const next: ActiveDrag = {
        taskId,
        initialCategoryId,
        snapshot,
        projection: snapshot,
        rowHeight,
      };

      dragSnapshotRef.current = snapshot;
      dragProjectionRef.current = snapshot;
      setActiveDrag(next);
      onReorderActiveChange?.(true);
    },
    [basePlacement, onReorderActiveChange]
  );

  const handleDragOver = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragOver']
        >
      >[0]
    ) => {
      const { source } = event.operation;
      if (!isSortable(source)) return;

      // React owns all task DOM ordering. dnd-kit keeps sensor/collision state,
      // but its OptimisticSortingPlugin must never reparent these rows.
      event.preventDefault();

      const snapshot = dragSnapshotRef.current;
      if (!snapshot) return;

      const next = move(snapshot, event) as TaskPlacement;
      if (!isTaskPlacementCompatible(next, snapshot, categoryIds)) return;

      const nextSignature = taskPlacementSignature(next, categoryIds);
      const previous = dragProjectionRef.current;
      if (
        previous &&
        taskPlacementSignature(previous, categoryIds) === nextSignature
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
      dragSnapshotRef.current = null;
      dragProjectionRef.current = null;
      setActiveDrag(null);

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

      if (
        !isTaskPlacementCompatible(
          finalPlacement,
          livePlacement,
          categoryIds
        )
      ) {
        return;
      }

      const snapshotSignature = taskPlacementSignature(snapshot, categoryIds);
      const nextSignature = taskPlacementSignature(
        finalPlacement,
        categoryIds
      );
      if (snapshotSignature === nextSignature) return;

      const commitId = ++commitIdRef.current;
      setCommittedPlacement({
        id: commitId,
        placement: finalPlacement,
        signature: nextSignature,
      });

      const affectedCategoryIds = Array.from(
        new Set([initialCategoryId, targetCategoryId])
      );
      const groups: TaskOrderGroup[] = affectedCategoryIds.map(
        (categoryId) => ({
          categoryId,
          taskIds: finalPlacement[categoryId] ?? [],
        })
      );

      void Promise.resolve()
        .then(() => onReorderTasks(dateStr, groups))
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
              onToggle={() => undefined}
              onOpenActions={() => undefined}
              onOpenMemo={() => undefined}
              onEditStart={() => undefined}
              onViewImage={() => undefined}
              isEditing={false}
              editValue=""
              onEditChange={() => undefined}
              onEditSave={() => undefined}
              onEditCancel={() => undefined}
              disableLayoutAnimation
              isDragOverlay
            />
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
};

const DaySlideComponent: React.FC<DaySlideProps> = ({
  reorderRuntimeActive = true,
  ...props
}) => {
  const { tasks, categories } = props;
  const categoryIds = React.useMemo(
    () => categories.map((category) => category.id),
    [categories]
  );
  const livePlacement = React.useMemo(
    () => buildTaskPlacement(tasks, categoryIds),
    [categoryIds, tasks]
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-sm">No categories yet</p>
      </div>
    );
  }

  if (!reorderRuntimeActive) {
    const tasksByCategory = buildRenderedTasksByCategory(
      tasks,
      livePlacement,
      categoryIds
    );
    return (
      <DaySlideContent
        {...props}
        reorderEnabled={false}
        reorderRuntimeActive={false}
        tasksByCategory={tasksByCategory}
        activeDrag={null}
      />
    );
  }

  return (
    <TaskReorderRuntime
      {...props}
      reorderRuntimeActive
      categoryIds={categoryIds}
      livePlacement={livePlacement}
    />
  );
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
