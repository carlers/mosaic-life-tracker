import React from 'react';
import { motion } from 'framer-motion';
import { CategorySection } from './CategorySection';
import { retirementStateForDay } from '../../../lib/categoryLifecycle';
import { useDayViewKeyboardNavigation } from './useDayViewKeyboardNavigation';
import { useKeyboardShortcuts } from '../../../hooks/keyboardShortcutsContext';
import { DayViewCategoryReorder } from './DayViewCategoryReorder';
import { SharedTaskRows } from './SharedTaskRows';
import type { SharedTaskItem, SharedCompletionCommand } from '../../../lib/taskShareQueue';
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../../../db/schema';
import type { TaskOrderGroup, TaskCompletionSortMode } from '../../../lib/taskOrder';
import type { TaskTimestampDisplay } from '../../../lib/taskTimeline';
import { anchoredDiaryPlacement, diarySlotIndex, type DiaryPlacement } from '../../../lib/diaryPlacement';
const DiaryDayPreview = React.lazy(() => import('./DiaryDayPreview').then(m => ({ default: m.DiaryDayPreview })));
import { DraggableDiaryDayPreview } from './DraggableDiaryDayPreview';
import { DiaryBoundaryDropSurface } from './TaskReorderSurfaces';
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
  emptyCategoryPrompt?: React.ReactNode;
  footerCategoryPrompt?: React.ReactNode;
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
  keyboardNavigationEnabled?: boolean;
  onShowKeyboardHelp?: () => void;
  selectedTaskIds?: ReadonlySet<string>;
  onToggleTaskSelection?: (taskId: string) => void;
  onToggleCategorySelection?: (categoryId: string) => void;
  reorderEnabled?: boolean;
  reorderRuntimeActive?: boolean;
  taskSortMode?: TaskCompletionSortMode;
  timestampDisplay?: TaskTimestampDisplay;
  onReorderTasks?: (
    dateStr: string,
    groups: readonly TaskOrderGroup[]
  ) => Promise<void> | void;
  onReorderActiveChange?: (active: boolean) => void;
  onCrossDayTaskStart?: (task: TaskDocument, rect: DOMRect, event?: Event | null, point?: { x: number; y: number }) => void;
  onCrossDayTaskMove?: (point: { x: number; y: number }, event?: Event | null) => void;
  onCrossDayNativeEnd?: (taskId: string, canceled: boolean) => boolean;
  crossDayDragTaskId?: string | null;
  crossDayInsertion?: { categoryId: string; index: number; height: number };

  onReorderCategories?: (next: CategoryDocument[]) => Promise<void>;
  onUpdateCategory?: (id: string, changes: Pick<CategoryDocument, 'name' | 'visibility' | 'color'>) => Promise<void>;
  onCategoryActionError?: (message: string) => void;
  diaryEnabled?: boolean;
  diaryEntryOverride?: DiaryDocument;
  diaryPlacement?: DiaryPlacement;
  onMoveDiary?: (target: DiaryPlacement) => Promise<void> | void;
  diaryDragging?: boolean;
  diaryReleaseRevision?: number;
  diarySettling?: boolean;
  settlingTaskId?: string | null;
  lastReleasedTask?: { taskId: string; revision: number } | null;
  diaryProjectedPlacement?: DiaryPlacement | null;
  diaryDragHeight?: number;
}

interface DaySlideContentProps extends DaySlideProps {
  tasksByCategory: Map<string, TaskDocument[]>;
  activeDrag: ActiveTaskDrag | null;
}

export const DaySlideContent: React.FC<DaySlideContentProps> = ({
  dateStr,
  scrollMode = 'page',
  categories,
  emptyCategoryPrompt,
  footerCategoryPrompt,
  currentUserId,
  sharedItems = [],
  ownerLabels,
  timestampDisplay,
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
  keyboardNavigationEnabled = false,
  onShowKeyboardHelp,
  selectedTaskIds = EMPTY_SELECTED_TASK_IDS,
  onToggleTaskSelection,
  onToggleCategorySelection,
  reorderEnabled = false,
  reorderRuntimeActive = false,
  onReorderActiveChange,
  crossDayDragTaskId,
  crossDayInsertion,
  onReorderCategories,
  onUpdateCategory,
  onCategoryActionError,
  tasksByCategory,
  activeDrag,
  diaryEnabled = false,
  diaryEntryOverride,
  diaryPlacement = { kind: 'top' },
  onMoveDiary,
  diaryDragging = false,
  diaryReleaseRevision = 0,
  diarySettling = false,
  settlingTaskId = null,
  lastReleasedTask = null,
  diaryProjectedPlacement = null,
  diaryDragHeight = 48,
}) => {
  const { enabled: shortcutsEnabled } = useKeyboardShortcuts();
  const { rootRef: keyboardRootRef, onKeyDown: handleBrowseKeyDown,
    onFocusCapture: handleBrowseFocus, onBlurCapture: handleBrowseBlur } =
    useDayViewKeyboardNavigation(
      keyboardNavigationEnabled && !activeDrag && !diaryDragging && !activeSharedDragId && !diarySettling,
      onShowKeyboardHelp,
      !selectionMode && editingTaskId === null,
      shortcutsEnabled
    );
  const projectedCategoryId = activeDrag
    ? findTaskCategory(activeDrag.projection, activeDrag.taskId)
    : null;
  const projectedGapIndex =
    activeDrag && projectedCategoryId
      ? activeDrag.projection[projectedCategoryId]?.indexOf(activeDrag.taskId) ??
        null
      : null;


  const diaryPlacementCategory = 'categoryId' in diaryPlacement ? diaryPlacement.categoryId : '';
  const isDiaryInCategory = Boolean(diaryPlacementCategory);
  const hasPlacementCategory = isDiaryInCategory &&
    categories.some(cat => cat.id === diaryPlacementCategory);
  const fallbackPlacement: DiaryPlacement =
    isDiaryInCategory && !hasPlacementCategory ? { kind: 'top' } : diaryPlacement;
  const diaryCategoryId = 'categoryId' in fallbackPlacement ? fallbackPlacement.categoryId : '';
  const diaryTaskIds = (tasksByCategory.get(diaryCategoryId) ?? []).map(task => task.id);
  const displayedDiarySlotIndex = diarySlotIndex(fallbackPlacement, diaryTaskIds);
  const migratedLegacySlot = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!diaryEnabled || !onMoveDiary || diaryPlacement.kind !== 'slot' ||
        !hasPlacementCategory || !diaryTaskIds.length ||
        diaryTaskIds.length < diaryPlacement.index) return;
    const key = `${dateStr}:${diaryPlacement.categoryId}:${diaryPlacement.index}`;
    if (migratedLegacySlot.current === key) return;
    migratedLegacySlot.current = key;
    const anchored = anchoredDiaryPlacement(
      diaryPlacement.categoryId, diaryPlacement.index, diaryTaskIds
    );
    void Promise.resolve().then(() => onMoveDiary(anchored)).catch(() => {
      if (migratedLegacySlot.current === key) migratedLegacySlot.current = null;
    });
  }, [dateStr, diaryEnabled, diaryPlacement, hasPlacementCategory, diaryTaskIds, onMoveDiary]);
  // Like tasks, reserve exactly one projected slot while the actual card
  // travels with the pointer. Neither the source nor the gap animates twice.
  const showDiaryGhost = Boolean(diaryEnabled && diaryDragging && diaryProjectedPlacement);
  const diaryGhost = showDiaryGhost
    ? <div data-diary-drag-gap="true" aria-hidden="true" style={{ height: diaryDragHeight }} />
    : null;
  const diaryCard = diaryEnabled ? (
    <motion.div
      data-diary-reorder-row="true"
      key={diaryReleaseRevision}
      layout={reorderRuntimeActive && !diaryDragging && !diarySettling ? 'position' : false}
      data-diary-source-slot={diaryDragging ? 'true' : undefined}
      className={diaryDragging ? '!invisible' : undefined}
      aria-hidden={diaryDragging ? true : undefined}
      style={diaryDragging ? {
        position: 'absolute', width: '100%', visibility: 'hidden', pointerEvents: 'none',
      } : undefined}
    >
      {reorderRuntimeActive
        ? <DraggableDiaryDayPreview date={dateStr} entryOverride={diaryEntryOverride}/>
        : <React.Suspense fallback={null}><DiaryDayPreview date={dateStr} entryOverride={diaryEntryOverride}/></React.Suspense>}
    </motion.div>
  ) : null;
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
    <motion.div
      ref={keyboardRootRef}
      onFocusCapture={handleBrowseFocus}
      onBlurCapture={handleBrowseBlur}
      onKeyDown={handleBrowseKeyDown}
      tabIndex={-1}
      aria-label="Day tasks"
      layoutScroll={scrollMode === 'contained' && reorderRuntimeActive}
      className={
        scrollMode === 'contained'
          ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-2 pb-8'
          : 'w-full min-w-0 px-4 pb-8'
      }
      data-testid="day-slide"
      data-date-str={dateStr}
      data-task-reorder-runtime={
        reorderRuntimeActive ? 'true' : undefined
      }
    >
      {emptyCategoryPrompt}
      {diaryEnabled && reorderRuntimeActive && <DiaryBoundaryDropSurface position="top" active={diaryDragging}/>}
      {diaryEnabled && fallbackPlacement.kind === 'top' && <motion.div data-diary-reorder-row="true" layout={diaryDragging || diarySettling ? false : 'position'}>{diaryCard}</motion.div>}
      {showDiaryGhost && diaryProjectedPlacement?.kind === 'top' && diaryGhost}
      <DayViewCategoryReorder
        categories={categories}
        animateExternal={Boolean(crossDayDragTaskId)}
        enabled={Boolean((reorderEnabled || (reorderRuntimeActive && crossDayDragTaskId)) &&
          onReorderCategories && onUpdateCategory && !selectionMode &&
          categories.every(category => category.userId === currentUserId))}
        canStartDrag={!crossDayDragTaskId && !activeDrag && !diaryDragging &&
          !activeSharedDragId && !diarySettling}
        onCommit={onReorderCategories ?? (async () => undefined)}
        onUpdate={onUpdateCategory ?? (async () => undefined)}
        onDragActiveChange={onReorderActiveChange}
        onError={onCategoryActionError}
        renderCategory={(category: CategoryDocument) => (
        <CategorySection
          key={category.id}
          categoryId={category.id}
          categoryName={category.name}
          categoryColor={category.color}
          diarySlot={diaryEnabled && diaryCategoryId === category.id ? diaryCard : undefined}
          diaryGhostSlot={showDiaryGhost &&
             diaryProjectedPlacement && 'categoryId' in diaryProjectedPlacement &&
             diaryProjectedPlacement.categoryId === category.id ? diaryGhost : undefined}
          diaryGhostSlotIndex={diaryProjectedPlacement && diaryProjectedPlacement.kind !== 'top' && diaryProjectedPlacement.kind !== 'bottom'
             ? diarySlotIndex(diaryProjectedPlacement, (tasksByCategory.get(category.id) ?? []).map(task => task.id)) : 0}
          animateDragProjection={reorderRuntimeActive || Boolean(crossDayDragTaskId)}
          diaryDragInProgress={diaryDragging}
          diarySettling={diarySettling}
          settlingTaskId={settlingTaskId}
          lastReleasedTask={lastReleasedTask}
          diarySlotIndex={displayedDiarySlotIndex}
          visibility={category.visibility}
          currentUserId={currentUserId}
          tasks={tasksByCategory.get(category.id) ?? []}
          canAddTasks={retirementStateForDay(category, dateStr,
            Boolean((tasksByCategory.get(category.id)?.length ?? 0) ||
              currentShares.some(item => sharedCategoryFor?.(item) === category.id))) !== 'existing-tasks-only'}
          ownerLabels={ownerLabels}
          timestampDisplay={timestampDisplay}
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
          onToggleCategorySelection={onToggleCategorySelection}
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
          externalDraggedTaskId={crossDayDragTaskId}
          externalRuntimeActive={Boolean(reorderRuntimeActive && crossDayDragTaskId)}
          externalGapIndex={crossDayInsertion?.categoryId === category.id ? crossDayInsertion.index : null}
          externalGapHeight={crossDayInsertion?.height ?? 0}
        />
      )}
      />
      {showDiaryGhost && diaryProjectedPlacement?.kind === 'bottom' && diaryGhost}
      {diaryEnabled && fallbackPlacement.kind === 'bottom' && <motion.div data-diary-reorder-row="true" layout={diaryDragging || diarySettling ? false : 'position'}>{diaryCard}</motion.div>}
      {diaryEnabled && reorderRuntimeActive && <DiaryBoundaryDropSurface position="bottom" active={diaryDragging}/>}
      {!selectionMode && unassignedShares.length > 0 &&
        onSharedCompletion && sharedPendingFor && (
        <SharedTaskRows items={unassignedShares} {...sharedRowProps} />
      )}
      {!selectionMode && onSharedCompletion && sharedPendingFor && (
        <SharedTaskRows items={currentShares} {...sharedRowProps}
          selectedItem={selectedSharedTask} actionsOnly
          onSheetOpenChange={onSharedSheetOpenChange} />
      )}
      {footerCategoryPrompt}
    </motion.div>
  );
};
