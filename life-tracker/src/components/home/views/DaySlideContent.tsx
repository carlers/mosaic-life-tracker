import React from 'react';
import { CategorySection } from './CategorySection';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import type { TaskOrderGroup } from '../../../lib/taskOrder';
import {
  findTaskCategory,
  type ActiveTaskDrag,
} from './taskReorder';

const EMPTY_SELECTED_TASK_IDS: ReadonlySet<string> = new Set();

export interface DaySlideProps {
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

export const DaySlideContent: React.FC<DaySlideContentProps> = ({
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
  selectedTaskIds = EMPTY_SELECTED_TASK_IDS,
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
      {categories.map((category) => (
        <CategorySection
          key={category.id}
          categoryId={category.id}
          categoryName={category.name}
          categoryColor={category.color}
          visibility={category.visibility}
          currentUserId={currentUserId}
          tasks={tasksByCategory.get(category.id) ?? []}
          onToggleTask={onToggleTask}
          onAddTask={(title) => onAddTask(title, category.id, dateStr)}
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
            activeDrag?.initialCategoryId === category.id
              ? activeDrag.taskId
              : null
          }
          dragGapIndex={
            projectedCategoryId === category.id ? projectedGapIndex : null
          }
          dragGapHeight={activeDrag?.rowHeight ?? 0}
        />
      ))}
    </div>
  );
};
