import React from 'react';
import { CategorySection } from './CategorySection';
import { SharedTaskRows } from './SharedTaskRows';
import type { SharedTaskItem, SharedCompletionCommand } from '../../../lib/taskShareQueue';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import type { TaskOrderGroup, TaskCompletionSortMode } from '../../../lib/taskOrder';
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
  sharedItems?: SharedTaskItem[];
  ownerLabels?: ReadonlyMap<string, string>;
  sharedCategoryFor?: (item: SharedTaskItem) => string;
  onAssignSharedCategory?: (item: SharedTaskItem, categoryId: string) => Promise<void>;
  onCopySharedTask?: (item: SharedTaskItem, categoryId: string) => Promise<void>;
  onEditSharedTitle?: (item: SharedTaskItem, title: string) => Promise<void>;
  onChangeSharedDate?: (item: SharedTaskItem, date: string) => Promise<void>;
  onMoveSharedTask?: (item: SharedTaskItem, categoryId: string, targetId: string, position: string) => Promise<void>;
  sharedOrderFor?: (item: SharedTaskItem) => number;
  onSharedMoveError?: (error: unknown) => void;
  activeSharedDragId?: string | null;
  onSharedSheetOpenChange?: (open: boolean) => void;
  onSharedCompletion?: (item: SharedTaskItem, completed: boolean) => Promise<unknown> | void;
  onLeaveSharedTask?: (item: SharedTaskItem) => Promise<unknown> | void;
  sharedPendingFor?: (taskId: string) => SharedCompletionCommand | undefined;
  editingTaskId: string | null;
  editValue: string;
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string, categoryId: string, dateStr: string, completed?: boolean) => void;
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
  taskSortMode?: TaskCompletionSortMode;
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
  sharedItems = [],
  ownerLabels,
  sharedCategoryFor,
  onAssignSharedCategory,
  onCopySharedTask,
  onEditSharedTitle,
  onChangeSharedDate,
  sharedOrderFor,
  activeSharedDragId,
  onSharedSheetOpenChange,
  onSharedCompletion,
  onLeaveSharedTask,
  sharedPendingFor,
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

  const currentShares = sharedItems.filter(item => item.status === 'accepted' && item.date === dateStr).sort((a,b)=> (sharedOrderFor?.(a) ?? 0) - (sharedOrderFor?.(b) ?? 0));
  const unassignedShares = currentShares.filter(item => !sharedCategoryFor?.(item));
  // Own the action sheet above category rows: moving a share must not unmount
  // its open sheet or consume its history entry while Swiper navigates.
  const [selectedSharedTask, setSelectedSharedTask] = React.useState<SharedTaskItem | null>(null);
  const sharedRowProps = {
    onSetCompleted: onSharedCompletion!,
    onLeave: onLeaveSharedTask,
    pendingFor: sharedPendingFor!,
    categories,
    categoryFor: sharedCategoryFor,
    onAssignCategory: onAssignSharedCategory,
    onCopy: onCopySharedTask,
    onEditTitle: onEditSharedTitle,
    onChangeDate: onChangeSharedDate,
    onSelectItem: setSelectedSharedTask,
    draggable: reorderRuntimeActive && !selectionMode,
    activeDragId: activeSharedDragId,
  };

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
          ownerLabels={ownerLabels}
          sharedRows={!selectionMode && onSharedCompletion && sharedPendingFor && currentShares.some(item => sharedCategoryFor?.(item) === category.id) && (
            <SharedTaskRows items={currentShares.filter(item =>
              sharedCategoryFor?.(item) === category.id)}
              {...sharedRowProps} compact />
          )}
          onToggleTask={onToggleTask}
          onAddTask={(title, completed) => onAddTask(title, category.id, dateStr, completed)}
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
      {!selectionMode && unassignedShares.length > 0 &&
        onSharedCompletion && sharedPendingFor && (
        <SharedTaskRows items={unassignedShares} {...sharedRowProps} />
      )}
      {!selectionMode && onSharedCompletion && sharedPendingFor && (
        <SharedTaskRows items={currentShares} {...sharedRowProps}
          selectedItem={selectedSharedTask} actionsOnly
          onSheetOpenChange={onSharedSheetOpenChange} />
      )}
    </div>
  );
};
