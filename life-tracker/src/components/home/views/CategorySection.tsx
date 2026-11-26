import React, { useContext, useEffect, useId, useRef, useState } from 'react';
import { CategoryPillActionContext, CategoryReorderDragContext } from './categoryPillActionContext';
import { CategoryManagerOpenContext } from './categoryManagerOpenContext';
import { getFocusedTaskCheckboxPreferences, markTaskCheckboxIntent } from './taskCheckboxPreferences';
import { ColorPalettePicker } from '../../ui/ColorPalettePicker';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckSquare, ChevronDown, MoreHorizontal, Plus, Square } from 'lucide-react';
import { DraggableTaskItem } from './DraggableTaskItem';
import { TaskItem } from './TaskItem';
import {
  CategoryHeaderDropSurface,
  CategoryHeaderFrame,
  TaskGapDropSurface,
  TaskRowDropSurface,
} from './TaskReorderSurfaces';
import { visibilityIcon } from '../../../lib/visibility';
import { getCategoryLabelColor } from '../../../constants/colors';
import type { ActivityDocument, CategoryDocument, TaskDocument } from '../../../db/schema';
import { isWorkoutRowId, mixedDiarySlotIndex } from '../../../lib/workoutDayPlacement';
const LazyDraggableWorkoutRow = React.lazy(() => import('./WorkoutCard').then(mod => ({ default: mod.DraggableWorkoutRow })));
const LazyWorkoutCard = React.lazy(() => import('./WorkoutCard').then(mod => ({ default: mod.WorkoutCard })));
import type { TaskTimestampDisplay } from '../../../lib/taskTimeline';

type Visibility = 'private' | 'followers' | 'public';


export interface CategoryPillActions {
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  consumeClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: React.MouseEventHandler<HTMLElement>;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  moveUp?: () => void;
  moveDown?: () => void;
  update: (changes: Pick<CategoryDocument, 'name' | 'visibility' | 'color'>) => Promise<void>;
}

const EMPTY_SELECTED_TASK_IDS: ReadonlySet<string> = new Set();

interface CategorySectionProps {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  visibility?: Visibility;
  canAddTasks?: boolean;
  currentUserId: string;
  tasks: TaskDocument[];
  workoutByRowId?: ReadonlyMap<string, ActivityDocument>;
  linkedWorkoutsByTaskId?: ReadonlyMap<string, ActivityDocument[]>;
  onOpenWorkout?: (activityId: string) => void;
  ownerLabels?: ReadonlyMap<string, string>;
  timestampDisplay?: TaskTimestampDisplay;
  sharedRows?: React.ReactNode;
  diarySlot?: React.ReactNode;
  diarySlotIndex?: number;
  diaryNoteSlots?: readonly { id: string; index: number; content: React.ReactNode }[];
  diaryNoteGhostIndex?: number | null;
  diaryNoteGhostHeight?: number;
  diaryNoteGhostOrder?: number | null;
  diaryNoteDraggingId?: string | null;
  diaryGhostSlot?: React.ReactNode;
  diaryGhostSlotIndex?: number;
  animateDragProjection?: boolean;
  /** Mixed task/diary drag owns row reflow; never animate a whole category over its pill. */
  mixedReorderActive?: boolean;
  diaryDragInProgress?: boolean;
  diarySettling?: boolean;
  settlingTaskId?: string | null;
  lastReleasedTask?: { taskId: string; revision: number } | null;
  onToggleTask: (taskId: string, currentStatus: boolean) => void | Promise<unknown>;
  onAddTask: (title: string, completed?: boolean) => void | Promise<void>;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument, mode: 'view' | 'edit') => void;
  onEditTask: (task: TaskDocument) => void;
  onViewImage?: (task: TaskDocument) => void;
  editingTaskId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  disableTaskLayoutAnimation?: boolean;
  continueAddingAfterSubmit?: boolean;
  showCollapseButton?: boolean;
  selectionMode?: boolean;
  selectedTaskIds?: ReadonlySet<string>;
  onToggleTaskSelection?: (taskId: string) => void;
  onToggleCategorySelection?: (categoryId: string) => void;
  reorderEnabled?: boolean;
  activeDragTaskId?: string | null;
  dragGapIndex?: number | null;
  dragGapHeight?: number;
  dragGapNote?: { id: string; side: 'before' | 'after' } | null;
  externalDraggedTaskId?: string | null;
  /** Keep task row wrappers mounted while the external slot becomes a saved row. */
  externalRuntimeActive?: boolean;
  externalGapIndex?: number | null;
  externalGapHeight?: number;
  categoryActions?: CategoryPillActions;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  categoryId,
  categoryName,
  categoryColor,
  visibility,
  canAddTasks = true,
  currentUserId,
  tasks,
  workoutByRowId,
  linkedWorkoutsByTaskId,
  onOpenWorkout,
  ownerLabels,
  timestampDisplay,
  sharedRows,
  diarySlot,
  diarySlotIndex = 0,
  diaryNoteSlots = [],
  diaryNoteGhostIndex = null,
  diaryNoteGhostHeight = 0,
  diaryNoteGhostOrder = null,
  diaryNoteDraggingId = null,
  diaryGhostSlot,
  diaryGhostSlotIndex = 0,
  animateDragProjection = false,
  mixedReorderActive = false,
  diaryDragInProgress = false,
  diarySettling = false,
  settlingTaskId = null,
  lastReleasedTask = null,
  onToggleTask,
  onAddTask,
  onOpenActions,
  onOpenMemo,
  onEditTask,
  onViewImage,
  editingTaskId,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  disableTaskLayoutAnimation = false,
  continueAddingAfterSubmit = false,
  showCollapseButton = false,
  selectionMode = false,
  selectedTaskIds = EMPTY_SELECTED_TASK_IDS,
  onToggleTaskSelection,
  onToggleCategorySelection,
  reorderEnabled = false,
  activeDragTaskId = null,
  dragGapIndex = null,
  dragGapHeight = 0,
  dragGapNote = null,
  externalDraggedTaskId = null,
  externalRuntimeActive = false,
  externalGapIndex = null,
  externalGapHeight = 0,
  categoryActions: suppliedCategoryActions,
}) => {
  const contextualActions = useContext(CategoryPillActionContext);
  const openCategoryManager = useContext(CategoryManagerOpenContext);
  const categoryActions = suppliedCategoryActions ?? contextualActions;
  const prefersReducedMotion = useReducedMotion();
  // The enclosing Reorder.Item owns the translation of the entire category.
  // Nested task and section projections fight it and repaint every task row.
  const categoryDragActive = useContext(CategoryReorderDragContext);
  const animatePositions = animateDragProjection && !prefersReducedMotion && !categoryDragActive;
  // During mixed task/Diary dragging, only the few rows adjacent to the
  // insertion slot need Motion measurement. The previous threshold animated
  // every row in categories <=28 and 15 rows in dense categories per gap
  // change. Keep the gap in normal flow for correct first/last geometry.
  const activeSlot = dragGapIndex ?? diaryNoteGhostIndex;
  const animateRowAt = (index: number) => animatePositions &&
    (!mixedReorderActive ||
      (activeSlot !== null && Math.abs(index - activeSlot) <= 3));
  const [isAdding, setIsAdding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const submittingRef = useRef(false);
  const closeAfterSubmitRef = useRef(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [editName, setEditName] = useState(categoryName);
  const [editVisibility, setEditVisibility] = useState<Visibility>(visibility ?? 'private');
  const [editColor, setEditColor] = useState(categoryColor);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const categoryPillRef = useRef<HTMLButtonElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!categoryActions?.menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (actionMenuRef.current?.contains(event.target as Node) ||
          categoryPillRef.current?.contains(event.target as Node) ||
          optionsButtonRef.current?.contains(event.target as Node)) return;
      categoryActions.setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      categoryActions.setMenuOpen(false);
      optionsButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
    };
  }, [categoryActions]);

  const startCategoryEdit = () => {
    setEditName(categoryName);
    setEditVisibility(visibility ?? 'private');
    setEditColor(categoryColor);
    setCategoryError('');
    categoryActions?.setMenuOpen(false);
    setEditingCategory(true);
  };
  const saveCategoryEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryActions || !editName.trim() || savingCategory) return;
    setSavingCategory(true);
    setCategoryError('');
    try {
      await categoryActions.update({ name: editName.trim(), visibility: editVisibility, color: editColor });
      setEditingCategory(false);
      optionsButtonRef.current?.focus();
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'Could not update category');
    } finally {
      setSavingCategory(false);
    }
  };
  const inputId = useId();

  // Stable ref callback: a rerender must not steal focus from a tapped target.
  const setInputRef = React.useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  const closeInput = () => {
    setNewTitle('');
    setIsAdding(false);
  };

  const commitAdd = (completed = false, keepAdding = continueAddingAfterSubmit) => {
    const title = newTitle.trim();
    if (!canAddTasks || !title || submittingRef.current) return;
    submittingRef.current = true;
    const succeeded = () => {
      submittingRef.current = false;
      const shouldClose = closeAfterSubmitRef.current || !keepAdding;
      closeAfterSubmitRef.current = false;
      if (shouldClose) closeInput();
      else setNewTitle(current => current.trim() === title ? '' : current);
    };
    const failed = () => {
      // Caller reports the failure. Retain the draft for a retry.
      submittingRef.current = false;
      closeAfterSubmitRef.current = false;
    };
    try {
      const result = onAddTask(title, completed);
      if (result && typeof result.then === 'function') void result.then(succeeded, failed);
      else succeeded();
    } catch {
      failed();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitAdd();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!submittingRef.current) closeInput();
    }
  };

  const handleBlur = () => {
    if (submittingRef.current) {
      // Enter may have initiated an async save before the tap-away.
      closeAfterSubmitRef.current = true;
      return;
    }
    if (newTitle.trim()) commitAdd(false, false);
    else closeInput();
  };

  const handleOpen = () => {
    if (!canAddTasks) return;
    setIsCollapsed(false);
    setIsAdding(true);
  };

  const categoryCollapsed = showCollapseButton && isCollapsed;
  // During cross-day carry, the native source is outside this day's list.
  // Keep a single neutral slot that pushes other rows (and entire categories)
  // aside, matching the ordinary same-day task reorder projection.
  const externalVisibleTasks = externalDraggedTaskId
    ? tasks.filter(task => task.id !== externalDraggedTaskId) : tasks;
  const externalSlotIndex = externalGapIndex === null ? null
    : Math.max(0, Math.min(externalGapIndex, externalVisibleTasks.length));
  const neutralSlot = (index: number) => externalSlotIndex === index
    ? <motion.div key="cross-day-slot" layout="position"
        data-cross-day-reorder-slot="true" aria-hidden="true"
        transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
        style={{ height: Math.max(1, externalGapHeight), pointerEvents: 'none' }} />
    : null;
  const ownedTasks = tasks.filter(task => !isWorkoutRowId(task.id));
  const allCategoryTasksSelected = ownedTasks.length > 0 &&
    ownedTasks.every(task => selectedTaskIds.has(task.id));
  const mixedDiaryIndex = mixedDiarySlotIndex(tasks, diarySlotIndex);
  const mixedGhostDiaryIndex = mixedDiarySlotIndex(tasks, diaryGhostSlotIndex);
  const canReorder =
    reorderEnabled &&
    !selectionMode &&
    !isAdding &&
    !editingCategory &&
    editingTaskId === null;

  const taskProps = (task: TaskDocument) => ({
    task,
    shareLabel: ownerLabels?.get(task.id),
    timestampDisplay,
    categoryColor,
    currentUserId,
    onToggle: () => onToggleTask(task.id, task.completed),
    onOpenActions,
    onOpenMemo,
    onEditStart: onEditTask,
    onViewImage,
    isEditing: editingTaskId === task.id,
    editValue,
    onEditChange,
    onEditSave,
    onEditCancel,
    disableLayoutAnimation: disableTaskLayoutAnimation || task.id === settlingTaskId,
    selectionMode,
    isSelected: selectedTaskIds.has(task.id),
    onToggleSelection: () => onToggleTaskSelection?.(task.id),
    linkedWorkouts: linkedWorkoutsByTaskId?.get(task.id),
    onOpenWorkout,
  });

  const renderTaskRow = (task: TaskDocument, draggable: boolean) => {
    const workout = workoutByRowId?.get(task.id);
    if (workout) return <React.Suspense fallback={null}>
      {draggable
        ? <LazyDraggableWorkoutRow activity={workout} categoryColor={categoryColor}
            onOpen={onOpenWorkout ?? (() => undefined)}/>
        : <LazyWorkoutCard activities={[workout]} categoryColor={categoryColor}
            onOpen={onOpenWorkout ?? (() => undefined)}/>}
    </React.Suspense>;
    return draggable
      ? <DraggableTaskItem {...taskProps(task)}/>
      : <TaskItem {...taskProps(task)}/>;
  };

  const handleToggleCollapse = () => {
    if (!categoryCollapsed) {
      closeInput();
    }
    setIsCollapsed((current) => !current);
  };

  const renderDraggableRows = () => {
    const rows: React.ReactNode[] = [];
    let visibleIndex = 0;
    const visibleTaskCount = Math.max(
      0,
      tasks.length - (activeDragTaskId ? 1 : 0)
    );
    const clampedGapIndex =
      dragGapIndex == null
        ? null
        : Math.max(0, Math.min(dragGapIndex, visibleTaskCount));

    const pushGap = () => {
      if (clampedGapIndex == null) return;
      rows.push(
        <TaskGapDropSurface
          key="task-drag-gap"
          categoryId={categoryId}
          index={clampedGapIndex}
          height={dragGapHeight}
        />
      );
    };

    // Bucket once: the previous per-task scan was O(tasks × diary entries)
    // and caused 100+ item months to drop frames during drag.
    const notesAt = new Map<number, typeof diaryNoteSlots[number][]>();
    for (const note of diaryNoteSlots) {
      const list = notesAt.get(note.index) ?? [];
      list.push(note);
      notesAt.set(note.index, list);
    }
    let gapRendered = false;
    const renderDiaryNotes = (index: number) => {
      const notes = notesAt.get(index) ?? [];
      const noteRow = (note: typeof diaryNoteSlots[number]) => (
        <TaskRowDropSurface key={`diary-note:${note.id}`} categoryId={categoryId}
          taskId={`diary_note_${note.id}`}
          eagerRegister={index < 12}
          acceptTasksOnly
          isActiveSource={note.id === diaryNoteDraggingId}
          animatePosition={animateRowAt(index) && !diaryNoteDraggingId && !activeDragTaskId}>
          {note.content}
        </TaskRowDropSurface>
      );
      const ghost = () => rows.push(<div key="diary-note-ghost"
        data-diary-note-gap="true" aria-hidden="true"
        style={{ height: diaryNoteGhostHeight, pointerEvents: 'none' }} className="rounded-lg bg-accent/10"/>);
      let visualOrder = 0;
      for (const note of notes) {
        if (note.id === diaryNoteDraggingId) {
          // Maintain the pointer-captured source node at its original DOM slot.
          // It is out-of-flow, so siblings never jump when its ghost moves.
          rows.push(noteRow(note));
          continue;
        }
        if (diaryNoteGhostIndex === index && diaryNoteGhostOrder === visualOrder) ghost();
        if (!gapRendered && dragGapNote?.id === note.id &&
            dragGapNote.side === 'before' && clampedGapIndex !== null) {
          pushGap(); gapRendered = true;
        }
        rows.push(noteRow(note));
        if (!gapRendered && dragGapNote?.id === note.id &&
            dragGapNote.side === 'after' && clampedGapIndex !== null) {
          pushGap(); gapRendered = true;
        }
        visualOrder++;
      }
      if (diaryNoteGhostIndex === index && diaryNoteGhostOrder === visualOrder) ghost();
    };
    const renderDiary = (index: number) => (
      <TaskRowDropSurface key="diary-slot" categoryId={categoryId}
        taskId={`diary_slot_${index}`} acceptTasksOnly eagerRegister
        animatePosition={animateRowAt(index) && !diaryDragInProgress && !diarySettling}>
        {diarySlot}
      </TaskRowDropSurface>
    );

    tasks.forEach((task, index) => {
      renderDiaryNotes(index);
      if (diarySlot && index === mixedDiaryIndex) rows.push(renderDiary(index));
      if (diaryGhostSlot && index === mixedGhostDiaryIndex) rows.push(<motion.div key="diary-preview-gap" layout={false}>{diaryGhostSlot}</motion.div>);
      const isActiveSource = task.id === activeDragTaskId;

      if (!isActiveSource && !gapRendered && !dragGapNote &&
          clampedGapIndex === visibleIndex) {
        pushGap(); gapRendered = true;
      }

      rows.push(
        <TaskRowDropSurface
          key={lastReleasedTask?.taskId === task.id
            ? `${task.id}:released:${lastReleasedTask.revision}`
            : task.id}
          categoryId={categoryId}
          taskId={task.id}
          acceptTasksOnly={isWorkoutRowId(task.id)}
          eagerRegister={index < 12}
          isActiveSource={isActiveSource}
          animatePosition={animateRowAt(index) && task.id !== settlingTaskId}
        >
          {renderTaskRow(task, true)}
        </TaskRowDropSurface>
      );

      if (!isActiveSource) {
        visibleIndex += 1;
      }
    });

    if (!gapRendered && !dragGapNote && clampedGapIndex === visibleIndex) {
      pushGap(); gapRendered = true;
    }
    renderDiaryNotes(tasks.length);
    if (diarySlot && mixedDiaryIndex >= tasks.length) rows.push(renderDiary(tasks.length));
    if (diaryGhostSlot && mixedGhostDiaryIndex >= tasks.length) rows.push(<motion.div key="diary-preview-gap" layout={false}>{diaryGhostSlot}</motion.div>);
    return rows;
  };

  const renderExternalRows = () => {
    const rows: React.ReactNode[] = [];
    const externalDiaryIndex = mixedDiarySlotIndex(externalVisibleTasks, diarySlotIndex);
    const externalGhostIndex = mixedDiarySlotIndex(externalVisibleTasks, diaryGhostSlotIndex);
    externalVisibleTasks.forEach((task, index) => {
      for (const note of diaryNoteSlots.filter(item => item.index === index))
        rows.push(<div key={`diary-note:${note.id}`} data-panel-reorder-row="true"
          style={note.id === diaryNoteDraggingId ? { position: 'absolute', opacity: 0 } : undefined}>
          {note.content}</div>);

      const slot = neutralSlot(index);
      if (slot) rows.push(slot);
      if (diarySlot && index === externalDiaryIndex) rows.push(diarySlot);
      if (diaryGhostSlot && index === externalGhostIndex) rows.push(diaryGhostSlot);
      // Keep the exact same wrapper and draggable child as normal same-day
      // sorting. Replacing these with a plain motion row during cross-day
      // carry previously remounted every sibling at release (visible flash).
      rows.push(externalRuntimeActive
        ? <TaskRowDropSurface key={task.id} categoryId={categoryId} taskId={task.id}
            acceptTasksOnly={isWorkoutRowId(task.id)} eagerRegister={index < 12} animatePosition={animatePositions}>
            {renderTaskRow(task, true)}
          </TaskRowDropSurface>
        : <motion.div key={task.id} data-panel-reorder-row="true" layout={animatePositions ? 'position' : false}
            transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}>
            {renderTaskRow(task, false)}
          </motion.div>
      );
    });
    for (const note of diaryNoteSlots.filter(item => item.index >= externalVisibleTasks.length))
      rows.push(<div key={`diary-note:${note.id}`} data-panel-reorder-row="true">{note.content}</div>);
    const trailingSlot = neutralSlot(externalVisibleTasks.length);
    if (trailingSlot) rows.push(trailingSlot);
    if (diarySlot && externalDiaryIndex >= externalVisibleTasks.length) rows.push(diarySlot);
    if (diaryGhostSlot && externalGhostIndex >= externalVisibleTasks.length) rows.push(diaryGhostSlot);
    return rows;
  };

  const categoryHeaderControls = (
    <div data-category-header-controls className="relative inline-flex max-w-full items-center gap-1">
      <button
        type="button"
        ref={categoryPillRef}
        data-day-keyboard-target="category"
        data-day-keyboard-id={categoryId || categoryName}
        onClickCapture={categoryActions?.consumeClick}
        onPointerDown={!editingCategory && !isAdding && editingTaskId === null
          ? categoryActions?.onPointerDown : undefined}
        onContextMenu={!editingCategory ? categoryActions?.onContextMenu : undefined}
        onClick={selectionMode ? () => onToggleCategorySelection?.(categoryId) : handleOpen}
        disabled={selectionMode
          ? (!onToggleCategorySelection || ownedTasks.length === 0)
          : !canAddTasks}
        className="mosaic-category-pill select-none inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-1 py-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        aria-label={selectionMode
          ? `${allCategoryTasksSelected ? 'Deselect all' : 'Select all'} tasks in ${categoryName}`
          : canAddTasks ? `Add a task to ${categoryName}` : `Retired category ${categoryName}; existing tasks only`}
        aria-pressed={selectionMode ? allCategoryTasksSelected : undefined}
        style={categoryActions && !selectionMode
          ? { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }
          : undefined}
      >
        {visibility && visibilityIcon(visibility, 12, 'text-gray-400')}
        <span
          className="text-[0.9375rem] font-bold"
          data-category-drag-handle={categoryActions && !editingCategory ? 'true' : undefined}
          style={{ color: getCategoryLabelColor(categoryColor),
            touchAction: categoryActions && !editingCategory ? 'none' : undefined,
            WebkitUserSelect: categoryActions && !editingCategory ? 'none' : undefined,
            userSelect: categoryActions && !editingCategory ? 'none' : undefined,
            WebkitTouchCallout: categoryActions && !editingCategory ? 'none' : undefined }}
        >
          {categoryName}
        </span>
        <span
          className="mosaic-category-add-icon inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400"
          aria-hidden="true"
        >
          {selectionMode
            ? allCategoryTasksSelected ? <CheckSquare size={18} /> : <Square size={18} />
            : <Plus data-testid="category-add-icon" size={18} />}
        </span>
      </button>
      {!canAddTasks && !selectionMode && (
        <span className="text-[11px] text-gray-400">Outside active dates · existing tasks</span>
      )}
      {showCollapseButton && (
        <button
          type="button"
          onClick={handleToggleCollapse}
          disabled={selectionMode}
          aria-label={
            categoryCollapsed
              ? `Expand ${categoryName}`
              : `Collapse ${categoryName}`
          }
          aria-expanded={!categoryCollapsed}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <ChevronDown
            size={17}
            aria-hidden="true"
            className={`transition-transform ${categoryCollapsed ? '-rotate-90' : ''}`}
          />
        </button>
      )}
      {categoryActions && !selectionMode && (
        <>
          <button
            type="button"
            ref={optionsButtonRef}
            aria-label={'Category options for ' + categoryName}
            aria-expanded={categoryActions.menuOpen}
            onClick={() => categoryActions.setMenuOpen(!categoryActions.menuOpen)}
            className="rounded-full p-1.5 text-gray-400 hover:bg-surfaceHighlight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <MoreHorizontal size={18} />
          </button>
          {categoryActions.menuOpen && (
            <div ref={actionMenuRef} role="group"
              aria-label={'Category actions for ' + categoryName}
              className="absolute right-0 top-full z-30 mt-1 flex flex-col gap-0.5 rounded-xl border border-[#333333] bg-surface p-1 shadow-xl"
            >
              <button type="button" onClick={startCategoryEdit}
                className="rounded-lg px-4 py-2 text-left text-sm text-white hover:bg-surfaceHighlight">
                Edit
              </button>
              {openCategoryManager && (
                <button type="button"
                  onClick={() => {
                    categoryActions.setMenuOpen(false);
                    // The menu item unmounts; make the stable ellipsis button
                    // the focus-return target for the nested BottomSheet.
                    optionsButtonRef.current?.focus({preventScroll: true});
                    openCategoryManager(categoryId);
                  }}
                  className="rounded-lg px-4 py-2 text-left text-sm text-white hover:bg-surfaceHighlight">
                  Manage category…
                </button>
              )}
              <button type="button" disabled={!categoryActions.moveUp}
                onClick={() => { categoryActions.moveUp?.(); categoryActions.setMenuOpen(false); }}
                className="rounded-lg px-4 py-2 text-left text-sm text-white hover:bg-surfaceHighlight disabled:opacity-40">
                Move up
              </button>
              <button type="button" disabled={!categoryActions.moveDown}
                onClick={() => { categoryActions.moveDown?.(); categoryActions.setMenuOpen(false); }}
                className="rounded-lg px-4 py-2 text-left text-sm text-white hover:bg-surfaceHighlight disabled:opacity-40">
                Move down
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const contents = (
    <>
      {canReorder ? (
        <CategoryHeaderDropSurface categoryId={categoryId}>
          {categoryHeaderControls}
        </CategoryHeaderDropSurface>
      ) : (
        <CategoryHeaderFrame>
          {categoryHeaderControls}
        </CategoryHeaderFrame>
      )}

      {editingCategory && categoryActions && !selectionMode && (
        <form onSubmit={(event) => { void saveCategoryEdit(event); }}
          aria-label={'Edit ' + categoryName}
          className="my-2 max-w-sm space-y-2 rounded-xl border border-[#333333] bg-surface p-3"
          onKeyDown={event => {
            if (event.key === 'Escape' && !savingCategory) {
              event.stopPropagation();
              setEditingCategory(false);
              optionsButtonRef.current?.focus();
            }
          }}
        >
          <label className="block text-sm text-gray-300">
            Category name
            <input autoFocus type="text" value={editName}
              onChange={event => setEditName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#444444] bg-background p-2 text-white"
            />
          </label>
          <div className="space-y-1">
            <span className="block text-sm text-gray-300">Category color</span>
            <ColorPalettePicker
              selectedColor={editColor}
              onSelect={setEditColor}
              ariaLabel="Category color"
            />
          </div>
          <label className="block text-sm text-gray-300">
            Visibility
            <select value={editVisibility}
              onChange={event => setEditVisibility(event.target.value as Visibility)}
              className="mt-1 w-full rounded-lg border border-[#444444] bg-background p-2 text-white">
              <option value="private">Private</option>
              <option value="followers">Friends</option>
              <option value="public">Public</option>
            </select>
          </label>
          {categoryError && <p role="alert" className="text-sm text-red-400">{categoryError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={savingCategory || !editName.trim()}
              className="rounded-lg bg-surfaceHighlight px-3 py-2 text-sm text-white disabled:opacity-40">
              Save
            </button>
            <button type="button" disabled={savingCategory}
              onClick={() => { setEditingCategory(false); optionsButtonRef.current?.focus(); }}
              className="rounded-lg px-3 py-2 text-sm text-gray-300">Cancel</button>
          </div>
        </form>
      )}

      {!categoryCollapsed && isAdding && canAddTasks && (
        <div
          data-testid="pending-task-row"
          className="flex items-start gap-3 rounded-lg pl-0 pr-2 py-2"
        >
          <button
            type="button"
            data-testid="pending-task-checkbox"
            aria-label="Create completed task"
            disabled={!newTitle.trim()}
            onPointerDown={(event) => {
              // A new direct creation action supersedes any older asynchronous
              // completion request that was waiting to blur this input.
              markTaskCheckboxIntent(getFocusedTaskCheckboxPreferences()?.input);
              // The adjacent input must retain focus until completion is committed.
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={() => commitAdd(true)}
            className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            style={{ borderColor: categoryColor }}
          />
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              New task title
            </label>
            <input
              id={inputId}
              data-task-inline-input
              data-task-creation-input
              ref={setInputRef}
               enterKeyHint="done"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={`Add a task to ${categoryName}...`}
              className="w-full bg-transparent text-white outline-none border-b"
              style={{
                borderBottomColor: categoryColor,
                borderBottomWidth: '2px',
              }}
            />
          </div>
        </div>
      )}

      {!categoryCollapsed &&
        (canReorder
          ? renderDraggableRows()
          : renderExternalRows())}
      {categoryCollapsed && externalSlotIndex !== null && neutralSlot(externalSlotIndex)}
      {categoryCollapsed && diarySlot}

      {categoryCollapsed && diaryGhostSlot}
      {categoryCollapsed && diaryNoteGhostIndex !== null && (
        <div data-diary-note-gap="true" aria-hidden="true"
          className="my-1 rounded-lg bg-accent/10"
          style={{ height: Math.max(1, diaryNoteGhostHeight), pointerEvents: 'none' }}/>
      )}
      {!categoryCollapsed && sharedRows}
    </>
  );

  return (
    <motion.div layout={animatePositions && !mixedReorderActive ? 'position' : false}
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
      className="mb-4" data-task-category-id={categoryId}>
      {contents}
    </motion.div>
  );
};
