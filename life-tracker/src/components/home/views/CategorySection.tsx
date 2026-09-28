import React, { useState, useRef, useId } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { TaskItem } from './TaskItem';
import { visibilityIcon } from '../../../lib/visibility';
import { getCategoryLabelColor } from '../../../constants/colors';
import type { TaskDocument } from '../../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

interface CategorySectionProps {
  categoryName: string;
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
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  categoryName,
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

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-3 py-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label={`Add a task to ${categoryName}`}
        >
          {visibility && visibilityIcon(visibility, 12, 'text-gray-400')}
          <span
            className="text-sm font-bold"
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
            className="min-w-0 flex-1 bg-transparent text-white outline-none border-b text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            style={{ borderBottomColor: categoryColor }}
          />
        </div>
      )}

      {!categoryCollapsed && tasks.map((task) => (
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
        />
      ))}
    </div>
  );
};
