import React, { useState, useRef, useId } from 'react';
import { Plus } from 'lucide-react';
import { TaskItem } from './TaskItem';
import { visibilityIcon } from '../../../lib/visibility';
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
  onOpenMemo: (task: TaskDocument) => void;
  onViewImage?: (task: TaskDocument) => void;
  editingTaskId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
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
  onViewImage,
  editingTaskId,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
}) => {
  const [isAdding, setIsAdding] = useState(false);
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
      closeInput();
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
    setIsAdding(true);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center mb-2">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-3 py-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label={`Add a task to ${categoryName}`}
        >
          {visibility && visibilityIcon(visibility, 12, 'text-gray-500')}
          <span
            className="text-sm font-bold"
            style={{ color: categoryColor }}
          >
            {categoryName}
          </span>
          <span className="text-gray-500" aria-hidden="true">
            <Plus size={14} />
          </span>
        </button>
      </div>

      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          categoryColor={categoryColor}
          currentUserId={currentUserId}
          onToggle={() => onToggleTask(task.id, task.completed)}
          onOpenActions={onOpenActions}
          onOpenMemo={onOpenMemo}
          onViewImage={onViewImage}
          isEditing={editingTaskId === task.id}
          editValue={editValue}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
        />
      ))}

      {isAdding && (
        <div className="flex items-center gap-2 py-2">
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
            className="flex-1 bg-transparent text-white outline-none border-b border-[#4B5563] text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          />
        </div>
      )}
    </div>
  );
};
