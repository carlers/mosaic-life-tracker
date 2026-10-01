import React from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import {
  PointerActivationConstraints,
  PointerSensor,
} from '@dnd-kit/dom';
import { CategorySection } from './CategorySection';
import { TaskItem } from './TaskItem';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import {
  buildTaskPlacement,
  isTaskPlacementCompatible,
  materializeTaskDocument,
  type TaskOrderGroup,
  type TaskPlacement,
} from '../../../lib/taskOrder';
import {
  buildAffectedTaskOrderGroups,
  buildRenderedTasksByCategory,
  findTaskCategory,
  projectTaskPlacement,
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

interface CommittedPlacement {
  id: number;
  placement: TaskPlacement;
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
  activeDrag: ActiveTaskDrag | null;
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
  reorderRuntimeActive = false,
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
      data-task-reorder-runtime={
        reorderRuntimeActive ? 'true' : undefined
      }
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
  const [activeDrag, setActiveDrag] = React.useState<ActiveTaskDrag | null>(null);
  const dragSnapshotRef = React.useRef<TaskPlacement | null>(null);
  const dragProjectionRef = React.useRef<TaskPlacement | null>(null);
  const dragTargetValidRef = React.useRef(false);
  const commitIdRef = React.useRef(0);

  const committedIsCompatible =
    committedPlacement !== null &&
    isTaskPlacementCompatible(
      committedPlacement.placement,
      livePlacement,
      categoryIds
    );
  const activeCommittedPlacement =
    committedPlacement && committedIsCompatible
      ? committedPlacement.placement
      : null;
  const basePlacement = activeCommittedPlacement ?? livePlacement;
  const renderPlacement = activeDrag?.snapshot ?? basePlacement;

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
      if (!source) return;

      const taskId = String(source.id);
      if (!taskById.has(taskId)) return;

      const snapshot = basePlacement;
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
      dragTargetValidRef.current = false;
      setActiveDrag(next);
      onReorderActiveChange?.(true);
    },
    [basePlacement, onReorderActiveChange, taskById]
  );

  const handleDragOver = React.useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof DragDropProvider>['onDragOver']
        >
      >[0]
    ) => {
      const snapshot = dragSnapshotRef.current;
      if (!snapshot) return;

      const { source, target } = event.operation;
      if (!source) return;

      const taskId = String(source.id);
      if (!target) {
        dragTargetValidRef.current = false;
        return;
      }

      const next = projectTaskPlacement(
        snapshot,
        taskId,
        String(target.id)
      );
      if (!next) {
        dragTargetValidRef.current = false;
        return;
      }

      dragTargetValidRef.current = true;

      const previous = dragProjectionRef.current;
      if (
        previous &&
        taskPlacementsEqual(previous, next, categoryIds)
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
      const hasValidTarget = dragTargetValidRef.current;
      dragSnapshotRef.current = null;
      dragProjectionRef.current = null;
      dragTargetValidRef.current = false;
      setActiveDrag(null);

      if (
        event.canceled ||
        !hasValidTarget ||
        !snapshot ||
        !finalPlacement ||
        !onReorderTasks
      ) {
        return;
      }

      const source = event.operation.source;
      if (!source) return;

      const taskId = String(source.id);

      if (
        !isTaskPlacementCompatible(
          finalPlacement,
          livePlacement,
          categoryIds
        )
      ) {
        return;
      }

      if (taskPlacementsEqual(snapshot, finalPlacement, categoryIds)) return;

      const groups = buildAffectedTaskOrderGroups(
        snapshot,
        finalPlacement,
        taskId
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
  const materializedTasks = React.useMemo(
    () => tasks.map(materializeTaskDocument),
    [tasks]
  );
  const categoryIds = React.useMemo(
    () => categories.map((category) => category.id),
    [categories]
  );
  const livePlacement = React.useMemo(
    () => buildTaskPlacement(materializedTasks, categoryIds),
    [categoryIds, materializedTasks]
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
      materializedTasks,
      livePlacement,
      categoryIds
    );
    return (
      <DaySlideContent
        {...props}
        tasks={materializedTasks}
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
      tasks={materializedTasks}
      reorderRuntimeActive
      categoryIds={categoryIds}
      livePlacement={livePlacement}
    />
  );
};

export const DaySlide = React.memo(DaySlideComponent);
DaySlide.displayName = 'DaySlide';
