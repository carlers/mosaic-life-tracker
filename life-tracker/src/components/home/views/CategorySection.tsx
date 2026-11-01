import React, { useContext, useEffect, useId, useRef, useState } from 'react';
import { CategoryPillActionContext } from './categoryPillActionContext';
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
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
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
  ownerLabels?: ReadonlyMap<string, string>;
  timestampDisplay?: TaskTimestampDisplay;
  sharedRows?: React.ReactNode;
  diarySlot?: React.ReactNode;
  diarySlotIndex?: number;
  diaryGhostSlot?: React.ReactNode;
  diaryGhostSlotIndex?: number;
  animateDragProjection?: boolean;
  diaryDragInProgress?: boolean;
  diarySettling?: boolean;
  settlingTaskId?: string | null;
  lastReleasedTask?: { taskId: string; revision: number } | null;
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string, completed?: boolean) => void;
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
  ownerLabels,
  timestampDisplay,
  sharedRows,
  diarySlot,
  diarySlotIndex = 0,
  diaryGhostSlot,
  diaryGhostSlotIndex = 0,
  animateDragProjection = false,
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
  externalDraggedTaskId = null,
  externalRuntimeActive = false,
  externalGapIndex = null,
  externalGapHeight = 0,
  categoryActions: suppliedCategoryActions,
}) => {
  const contextualActions = useContext(CategoryPillActionContext);
  const categoryActions = suppliedCategoryActions ?? contextualActions;
  const prefersReducedMotion = useReducedMotion();
  const animatePositions = animateDragProjection && !prefersReducedMotion;
  const [isAdding, setIsAdding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
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

  const setInputRef = (node: HTMLInputElement | null) => {
    node?.focus();
  };

  const closeInput = () => {
    setNewTitle('');
    setIsAdding(false);
  };

  const commitAdd = (completed = false) => {
    if (!canAddTasks) return;
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddTask(trimmed, completed);
      if (continueAddingAfterSubmit) {
        setNewTitle('');
      } else {
        closeInput();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAdd();
    } else if (e.key === 'Escape') {
      closeInput();
    }
  };

  const handleBlur = () => {
    if (!newTitle.trim()) {
      closeInput();
    }
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
  const allCategoryTasksSelected = tasks.length > 0 &&
    tasks.every(task => selectedTaskIds.has(task.id));
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
  });

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

    const renderDiary = (index: number) => (
      <TaskRowDropSurface key="diary-slot" categoryId={categoryId}
        taskId={`diary_slot_${index}`} acceptTasksOnly eagerRegister
        animatePosition={animatePositions && !diaryDragInProgress && !diarySettling}>
        {diarySlot}
      </TaskRowDropSurface>
    );

    tasks.forEach((task, index) => {
      if (diarySlot && index === Math.min(tasks.length, diarySlotIndex)) rows.push(renderDiary(index));
      if (diaryGhostSlot && index === Math.min(tasks.length, diaryGhostSlotIndex)) rows.push(<motion.div key="diary-preview-gap" layout={false}>{diaryGhostSlot}</motion.div>);
      const isActiveSource = task.id === activeDragTaskId;

      if (!isActiveSource && clampedGapIndex === visibleIndex) {
        pushGap();
      }

      rows.push(
        <TaskRowDropSurface
          key={lastReleasedTask?.taskId === task.id
            ? `${task.id}:released:${lastReleasedTask.revision}`
            : task.id}
          categoryId={categoryId}
          taskId={task.id}
          eagerRegister={index < 12}
          isActiveSource={isActiveSource}
          animatePosition={animatePositions && task.id !== settlingTaskId}
        >
          <DraggableTaskItem {...taskProps(task)} />
        </TaskRowDropSurface>
      );

      if (!isActiveSource) {
        visibleIndex += 1;
      }
    });

    if (clampedGapIndex === visibleIndex) {
      pushGap();
    }
    if (diarySlot && diarySlotIndex >= tasks.length) rows.push(renderDiary(Math.min(tasks.length, diarySlotIndex)));
    if (diaryGhostSlot && diaryGhostSlotIndex >= tasks.length) rows.push(<motion.div key="diary-preview-gap" layout={false}>{diaryGhostSlot}</motion.div>);
    return rows;
  };

  const renderExternalRows = () => {
    const rows: React.ReactNode[] = [];
    externalVisibleTasks.forEach((task, index) => {
      const slot = neutralSlot(index);
      if (slot) rows.push(slot);
      if (diarySlot && index === Math.min(externalVisibleTasks.length, diarySlotIndex)) rows.push(diarySlot);
      if (diaryGhostSlot && index === Math.min(externalVisibleTasks.length, diaryGhostSlotIndex)) rows.push(diaryGhostSlot);
      // Keep the exact same wrapper and draggable child as normal same-day
      // sorting. Replacing these with a plain motion row during cross-day
      // carry previously remounted every sibling at release (visible flash).
      rows.push(externalRuntimeActive
        ? <TaskRowDropSurface key={task.id} categoryId={categoryId} taskId={task.id}
            eagerRegister={index < 12} animatePosition={animatePositions}>
            <DraggableTaskItem {...taskProps(task)} />
          </TaskRowDropSurface>
        : <motion.div key={task.id} data-panel-reorder-row="true" layout={animatePositions ? 'position' : false}
            transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}>
            <TaskItem {...taskProps(task)} />
          </motion.div>
      );
    });
    const trailingSlot = neutralSlot(externalVisibleTasks.length);
    if (trailingSlot) rows.push(trailingSlot);
    if (diarySlot && diarySlotIndex >= externalVisibleTasks.length) rows.push(diarySlot);
    if (diaryGhostSlot && diaryGhostSlotIndex >= externalVisibleTasks.length) rows.push(diaryGhostSlot);
    return rows;
  };

  const categoryHeaderControls = (
    <div className="relative inline-flex max-w-full items-center gap-1">
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
          ? (!onToggleCategorySelection || tasks.length === 0)
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
        <span className="text-[11px] text-gray-400">Retired · existing tasks</span>
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
              ref={setInputRef}
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
      {!categoryCollapsed && sharedRows}
    </>
  );

  return (
    <motion.div layout={animatePositions ? 'position' : false} transition={{ layout: { duration: 0.2, ease: 'easeOut' } }} className="mb-4" data-task-category-id={categoryId}>
      {contents}
    </motion.div>
  );
};
