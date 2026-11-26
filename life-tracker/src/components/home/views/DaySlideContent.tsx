import React from 'react';
import './fullWidthCategoryPills.css';
import { motion } from 'framer-motion';
import { CategorySection } from './CategorySection';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { useDayViewKeyboardNavigation } from './useDayViewKeyboardNavigation';
import { useKeyboardShortcuts } from '../../../hooks/keyboardShortcutsContext';
import { DayViewCategoryReorder } from './DayViewCategoryReorder';
import { SharedTaskRows } from './SharedTaskRows';
import type { SharedTaskItem, SharedCompletionCommand } from '../../../lib/taskShareQueue';
import type { CategoryDocument, TaskDocument, DiaryDocument } from '../../../db/schema';
import type { TaskOrderGroup, TaskCompletionSortMode } from '../../../lib/taskOrder';
import type { TaskTimestampDisplay } from '../../../lib/taskTimeline';
import type { FullWidthCategoryPillTextAlignment } from '../../../lib/dayViewPreferences';
import { anchoredDiaryPlacement, diarySlotIndex, type DiaryPlacement } from '../../../lib/diaryPlacement';
import { DiaryDayPreview } from './DiaryDayPreview';
import type { DiaryDayUiSession } from './DiaryDayPreview';
import { DraggableDiaryDayPreview } from './DraggableDiaryDayPreview';
import { DiaryBoundaryDropSurface } from './TaskReorderSurfaces';
import { useDiary } from '../../../hooks/useDiary';
import { OwnerDiaryContext } from '../../../hooks/ownerDiaryContext';
import { useSettings } from '../../../hooks/useSettings';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { noteDisplayTitle } from '../../../lib/diaryNotes';
import { DiaryNoteDayContext } from './diaryNoteDayContext';
import { DiaryNoteInline } from './DiaryNoteInline';
import { useDiaryNoteInteractions } from './useDiaryNoteInteractions';
const DiaryEntrySheet = React.lazy(() => import('./DiaryEntrySheet').then(m => ({ default: m.DiaryEntrySheet })));
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
  onToggleTask: (taskId: string, currentStatus: boolean) => void | Promise<unknown>;
  onAddTask: (title: string, categoryId: string, dateStr: string, completed?: boolean) => void | Promise<void>;
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
  fullWidthCategoryPills?: boolean;
  fullWidthCategoryPillTextAlignment?: FullWidthCategoryPillTextAlignment;
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
  onCrossDayDiaryStart?: (kind: 'note' | 'group', entries: readonly DiaryDocument[], date: string, rect: DOMRect) => void;
  onCrossDayDiaryMove?: (point: { x: number; y: number }, event?: Event | null) => boolean;
  onCrossDayDiaryNativeEnd?: (kind: 'note' | 'group', id?: string) => boolean;
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
  diaryGroupSession?: DiaryDayUiSession | null;
  onDiaryGroupSessionChange?: (value: DiaryDayUiSession) => void;
  /** Optimistic anchor repair while a shared task drag is being persisted. */
  diaryNoteRuntimeOverrides?: ReadonlyMap<string, unknown>;
}

interface DaySlideContentProps extends DaySlideProps {
  tasksByCategory: Map<string, TaskDocument[]>;
  activeDrag: ActiveTaskDrag | null;
}

interface DiaryNoteOwnerData {
  diaryNoteEntries?: readonly DiaryDocument[];
  diaryGetSetting?: (key: string) => unknown;
  diarySetSetting?: (key: string, value: unknown) => Promise<void>;
  diaryUpdateEntry?: (id: string, date: string, content: string,
    visibility: DiaryDocument['visibility'], emoji: string, photos?: string,
    titleOnly?: boolean) => Promise<void>;
  diaryDeleteEntry?: (id: string) => Promise<void>;
}

const DaySlideContentInner: React.FC<DaySlideContentProps & DiaryNoteOwnerData> = ({
  dateStr,
  diaryNoteEntries,
  diaryGetSetting,
  diarySetSetting,
  diaryUpdateEntry,
  diaryDeleteEntry,
  diaryNoteRuntimeOverrides,
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
  fullWidthCategoryPills = false,
  fullWidthCategoryPillTextAlignment = 'left',
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
  onCrossDayDiaryStart,
  onCrossDayDiaryMove,
  onCrossDayDiaryNativeEnd,
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
  diaryGroupSession,
  onDiaryGroupSessionChange,
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
  const [selectedNote, setSelectedNote] = React.useState<{
    id: string; editing: boolean;
  } | null>(null);
  const openDiaryNote = React.useCallback((id: string) =>
    setSelectedNote({ id, editing: false }), []);
  const editDiaryNote = React.useCallback((id: string) =>
    setSelectedNote({ id, editing: true }), []);
  const selectedNoteEntry = selectedNote
    ? diaryNoteEntries?.find(entry => entry.id === selectedNote.id && !entry.isDeleted)
    : undefined;
  const { value: retainedNote, onExitComplete: releaseNote } = useRetainedSheetValue(
    selectedNoteEntry ? { id: selectedNoteEntry.id, entry: selectedNoteEntry } : null,
    selectedNote !== null && Boolean(selectedNoteEntry)
  );
  const { notePlan, context: noteContext, hover: noteDragHover, overlay: noteOverlay, readSetting } =
    useDiaryNoteInteractions({
      date: dateStr, entries: diaryNoteEntries ?? [], categories, tasksByCategory,
      getSetting: diaryGetSetting, setSetting: diarySetSetting,
      onError: onCategoryActionError, runtimeOverrides: diaryNoteRuntimeOverrides,
      onCrossDayStart: onCrossDayDiaryStart,
      onCrossDayMove: onCrossDayDiaryMove,
      onCrossDayEnd: onCrossDayDiaryNativeEnd,
      onReorderActiveChange,
    });
  // The outer category FLIP must stay paused until the released task or
  // grouped Diary card has finished its two-frame handoff. Re-enabling it
  // on pointer-up makes a category pill jump over the arriving first/last row.
  const mixedReorderActive = Boolean(activeDrag || diaryDragging || diarySettling ||
    settlingTaskId || noteContext?.floatingEntryId);
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
  const diaryCard = React.useMemo(() => diaryEnabled ? (
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
        ? <DraggableDiaryDayPreview date={dateStr} entryOverride={diaryEntryOverride}
            sessionState={diaryGroupSession}
            onSessionStateChange={onDiaryGroupSessionChange}/>
        : <React.Suspense fallback={null}><DiaryDayPreview date={dateStr} entryOverride={diaryEntryOverride}/></React.Suspense>}
    </motion.div>
  ) : null, [diaryEnabled, diaryReleaseRevision, reorderRuntimeActive,
    diaryDragging, diarySettling, dateStr, diaryEntryOverride,
    diaryGroupSession, onDiaryGroupSessionChange]);
  // Only the old/new hover category should change during a Diary drag.
  // Memoized slot arrays and content allow full prop-equality reuse of every
  // unaffected category despite the Day Slide's required hover re-render.
  const diaryNotesByCategory = React.useMemo(() => {
    const result = new Map<string, Array<{
      id: string; index: number; content: React.ReactNode }>>();
    if (noteContext && notePlan.mode === 'distributed') {
      for (const note of notePlan.placed) {
        const slots = result.get(note.position.categoryId) ?? [];
        slots.push({ id: note.entry.id, index: note.slot,
          content: <DiaryNoteInline entry={note.entry}
            title={noteDisplayTitle(note.entry, readSetting)}
            onOpen={openDiaryNote}
            onEdit={editDiaryNote}/> });
        result.set(note.position.categoryId, slots);
      }
    }
    return result;
  }, [noteContext, notePlan.mode, notePlan.placed, readSetting, openDiaryNote, editDiaryNote]);
  const currentShares = React.useMemo(() => sharedItems
    .filter(item => item.status === 'accepted' && item.date === dateStr)
    .sort((a,b) => (sharedOrderFor?.(a) ?? 0) - (sharedOrderFor?.(b) ?? 0)),
    [sharedItems, dateStr, sharedOrderFor]);
  const unassignedShares = React.useMemo(
    () => currentShares.filter(item => !sharedCategoryFor?.(item)),
    [currentShares, sharedCategoryFor]);
  // Own the action sheet above category rows: moving a share must not unmount
  // its open sheet or consume its history entry while Swiper navigates.
  const [selectedSharedTask, setSelectedSharedTask] = React.useState<SharedTaskItem | null>(null);
  const sharedRowProps = React.useMemo(() => ({
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
  }), [onSharedCompletion, onLeaveSharedTask, sharedPendingFor, categories,
    sharedCategoryFor, onAssignSharedCategory, onCopySharedTask, onEditSharedTitle,
    onChangeSharedDate, reorderRuntimeActive, selectionMode,
    activeSharedDragId]);

  const addTaskByCategory = React.useMemo(
    () => new Map(categories.map(category => [
      category.id, (title: string, completed?: boolean) =>
        onAddTask(title, category.id, dateStr, completed),
    ] as const)), [categories, onAddTask, dateStr]);
  const sharedRowsByCategory = React.useMemo(() => {
    const result = new Map<string, React.ReactNode>();
    if (!selectionMode && onSharedCompletion && sharedPendingFor && sharedCategoryFor) {
      for (const category of categories) {
        const items = currentShares.filter(item => sharedCategoryFor(item) === category.id);
        if (items.length)
          result.set(category.id, <SharedTaskRows items={items} {...sharedRowProps} compact />);
      }
    }
    return result;
  }, [selectionMode, onSharedCompletion, sharedPendingFor, sharedCategoryFor,
    categories, currentShares, sharedRowProps]);

  return (
    <DiaryNoteDayContext.Provider value={noteContext}>
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
      data-full-width-category-pills={fullWidthCategoryPills ? 'true' : undefined}
      data-full-width-category-pill-text-alignment={fullWidthCategoryPills ? fullWidthCategoryPillTextAlignment : undefined}
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
        animateExternal={Boolean(crossDayDragTaskId || crossDayInsertion)}
        pauseLayoutWhileMixedDrag={mixedReorderActive}
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
          diaryNoteSlots={diaryNotesByCategory.get(category.id)}
          diaryNoteGhostIndex={noteDragHover?.categoryId === category.id ? noteDragHover.index : null}
          diaryNoteGhostHeight={noteDragHover?.height ?? 0}
          diaryNoteGhostOrder={noteDragHover?.categoryId === category.id ? noteDragHover.order : null}
          diaryNoteDraggingId={noteContext?.floatingEntryId ?? null}
          diaryGhostSlot={showDiaryGhost &&
             diaryProjectedPlacement && 'categoryId' in diaryProjectedPlacement &&
             diaryProjectedPlacement.categoryId === category.id ? diaryGhost : undefined}
          diaryGhostSlotIndex={diaryProjectedPlacement && diaryProjectedPlacement.kind !== 'top' && diaryProjectedPlacement.kind !== 'bottom'
             ? diarySlotIndex(diaryProjectedPlacement, (tasksByCategory.get(category.id) ?? []).map(task => task.id)) : 0}
          animateDragProjection={reorderRuntimeActive || Boolean(crossDayDragTaskId)}
          mixedReorderActive={mixedReorderActive}
          diaryDragInProgress={diaryDragging}
          diarySettling={diarySettling}
          settlingTaskId={settlingTaskId}
          lastReleasedTask={lastReleasedTask}
          diarySlotIndex={displayedDiarySlotIndex}
          visibility={category.visibility}
          currentUserId={currentUserId}
          tasks={tasksByCategory.get(category.id) ?? []}
          canAddTasks={canAddNewTaskToCategory(category, dateStr)}
          ownerLabels={ownerLabels}
          timestampDisplay={timestampDisplay}
          sharedRows={sharedRowsByCategory.get(category.id)}
          onToggleTask={onToggleTask}
          onAddTask={addTaskByCategory.get(category.id)!}
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
          dragGapNote={projectedCategoryId === category.id ? activeDrag?.noteTarget : null}
          externalDraggedTaskId={crossDayDragTaskId}
          externalRuntimeActive={Boolean(reorderRuntimeActive && (crossDayDragTaskId || crossDayInsertion))}
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
    {noteOverlay}
    {retainedNote && <React.Suspense fallback={null}>
      <DiaryEntrySheet key={retainedNote.id} isOpen={selectedNote !== null}
        date={retainedNote.entry.date} entry={retainedNote.entry} author="Me"
        onExitComplete={releaseNote}
        onSave={async (date, content, visibility, emoji, photos, _retryId, titleOnly) => {
          await diaryUpdateEntry?.(retainedNote.id, date, content, visibility, emoji, photos, titleOnly);
        }}
        onDelete={async () => { await diaryDeleteEntry?.(retainedNote.id); }}
        initialEditing={selectedNote?.editing === true} onClose={() => setSelectedNote(null)}
      />
    </React.Suspense>}
    </DiaryNoteDayContext.Provider>
  );
};

/** No additional Diary hooks are mounted on the task-only path. */
const OwnerDiaryNotesContent: React.FC<DaySlideContentProps> = props => {
  const snapshot = React.useContext(OwnerDiaryContext);
  const { entries: localEntries, updateEntry, deleteEntryById } = useDiary(!snapshot);
  const { getSetting, setSetting } = useSettings();
  const entries = snapshot?.entries ?? localEntries;
  return <DaySlideContentInner {...props}
    diaryNoteEntries={entries}
    diaryGetSetting={getSetting}
    diarySetSetting={setSetting}
    diaryUpdateEntry={updateEntry}
    diaryDeleteEntry={deleteEntryById}/>;
};

export const DaySlideContent: React.FC<DaySlideContentProps> = props =>
  props.diaryEnabled && !props.diaryEntryOverride
    ? <OwnerDiaryNotesContent {...props}/>
    : <DaySlideContentInner {...props}/>;
