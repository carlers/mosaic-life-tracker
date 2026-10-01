import React, { useState, useRef, useId } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { TaskItem } from './TaskItem';
import { visibilityIcon } from '../../../lib/visibility';
import { getCategoryLabelColor } from '../../../constants/colors';
import type { TaskDocument } from '../../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

interface CategorySectionProps {
  categoryName: string;
  categoryId?: string;
  categoryColor: string;
  visibility?: Visibility;
  currentUserId: string;
  tasks: TaskDocument[];
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string) => void;
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
  reorderEnabled?: boolean;
  onReorderActivate?: (task: TaskDocument, pointerId: number, pointerType: string, x: number, y: number) => void;
  draggedTaskId?: string | null;
  insertionIndex?: number | null;
  reorderPlaceholderHeight?: number;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  categoryName,
  categoryId,
  categoryColor,
  visibility,
  currentUserId,
  tasks,
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
  selectedTaskIds = new Set<string>(),
  onToggleTaskSelection,
  reorderEnabled,
  onReorderActivate,
  draggedTaskId,
  insertionIndex = null,
  reorderPlaceholderHeight = 40,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (node) {
      node.focus();
    }
  };

  const closeInput = () => {
    setNewTitle('');
    setIsAdding(false);
  };

  const commitAdd = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddTask(trimmed);
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
    setIsCollapsed(false);
    setIsAdding(true);
  };

  const categoryCollapsed = showCollapseButton && isCollapsed;

  const handleToggleCollapse = () => {
    if (!categoryCollapsed) {
      closeInput();
    }
    setIsCollapsed((current) => !current);
  };

  const renderTask = (task: TaskDocument, index: number, isReorderAnchor = false) => (
    <TaskItem
      key={task.id}
      task={task}
      categoryColor={categoryColor}
      currentUserId={currentUserId}
      onToggle={() => onToggleTask(task.id, task.completed)}
      onOpenActions={onOpenActions}
      onOpenMemo={onOpenMemo}
      onEditStart={onEditTask}
      onViewImage={onViewImage}
      isEditing={editingTaskId === task.id}
      editValue={editValue}
      onEditChange={onEditChange}
      onEditSave={onEditSave}
      onEditCancel={onEditCancel}
      disableLayoutAnimation={disableTaskLayoutAnimation}
      selectionMode={selectionMode}
      isSelected={selectedTaskIds.has(task.id)}
      onToggleSelection={() => onToggleTaskSelection?.(task.id)}
      reorderEnabled={!isReorderAnchor && reorderEnabled && !isAdding && !categoryCollapsed}
      onReorderActivate={onReorderActivate}
      isReorderSource={isReorderAnchor}
      isReorderAnchor={isReorderAnchor}
      reorderLayoutDependency={`${categoryId}:${index}:${insertionIndex ?? 'none'}`}
    />
  );

  const taskRows: React.ReactNode[] = [];
  if (!categoryCollapsed) {
    let visibleIndex = 0;
    tasks.forEach((task, index) => {
      const isReorderAnchor = task.id === draggedTaskId;
      if (!isReorderAnchor && insertionIndex === visibleIndex) {
        taskRows.push(
          <div
            key={`task-drop-${categoryId}-${visibleIndex}`}
            data-testid="task-drop-placeholder"
            data-task-drop-index={visibleIndex}
            aria-hidden="true"
            className="mx-2"
            style={{ height: reorderPlaceholderHeight }}
          />
        );
      }
      taskRows.push(renderTask(task, index, isReorderAnchor));
      if (!isReorderAnchor) visibleIndex += 1;
    });
    if (insertionIndex === visibleIndex) {
      taskRows.push(
        <div
          key={`task-drop-${categoryId}-${visibleIndex}`}
          data-testid="task-drop-placeholder"
          data-task-drop-index={visibleIndex}
          aria-hidden="true"
          className="mx-2"
          style={{ height: reorderPlaceholderHeight }}
        />
      );
    }
  }

  return (
    <div className="mb-4" data-category-id={categoryId}>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={selectionMode}
          className="inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-3 py-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label={`Add a task to ${categoryName}`}
        >
          {visibility && visibilityIcon(visibility, 12, 'text-gray-400')}
          <span
            className="text-[0.9375rem] font-bold"
            style={{ color: getCategoryLabelColor(categoryColor) }}
          >
            {categoryName}
          </span>
          <span className="text-gray-400" aria-hidden="true">
            <Plus data-testid="category-add-icon" size={18} />
          </span>
        </button>
        {showCollapseButton && (
          <button
            type="button"
          onClick={handleToggleCollapse}
          disabled={selectionMode}
            aria-label={categoryCollapsed ? `Expand ${categoryName}` : `Collapse ${categoryName}`}
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
      </div>

      {!categoryCollapsed && isAdding && (
        <div
          data-testid="pending-task-row"
          className="flex items-center gap-3 py-2"
        >
          <span
            data-testid="pending-task-checkbox"
            aria-hidden="true"
            className="shrink-0 h-6 w-6 rounded-full border-2"
            style={{ borderColor: categoryColor }}
          />
          <label htmlFor={inputId} className="sr-only">
            New task title
          </label>
          <input
            id={inputId}
            ref={setInputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={`Add a task to ${categoryName}...`}
            className="min-w-0 flex-1 bg-transparent text-white outline-none border-b text-sm"
            style={{ borderBottomColor: categoryColor }}
          />
        </div>
      )}

      {!categoryCollapsed && <>{taskRows}</>}
    </div>
  );
};
