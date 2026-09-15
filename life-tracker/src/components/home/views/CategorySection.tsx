import React, { useState, useRef, useEffect } from 'react';
import { Plus, Eye, EyeOff, Users } from 'lucide-react';
import { TaskItem } from './TaskItem';
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
  visibility = 'private',
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
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAdd = () => {
    if (newTaskTitle.trim()) {
      onAddTask(newTaskTitle.trim());
      setNewTaskTitle('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskTitle('');
    }
  };

  const getVisibilityIcon = (v: Visibility) => {
    switch (v) {
      case 'public':
        return <Eye size={12} className="text-gray-500" />;
      case 'followers':
        return <Users size={12} className="text-gray-500" />;
      case 'private':
        return <EyeOff size={12} className="text-gray-500" />;
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center mb-2">
        <div
          onClick={() => setIsAdding(!isAdding)}
          className={`inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-4 py-2 cursor-pointer transition-all active:scale-95 ${
            isAdding
              ? 'ring-1 ring-[#555555]'
              : 'hover:bg-[#0D0D0D]'
          }`}
        >
          {getVisibilityIcon(visibility)}
          <span
            className="text-sm font-bold"
            style={{ color: categoryColor }}
          >
            {categoryName}
          </span>
          <Plus
            size={16}
            strokeWidth={2.5}
            style={{ color: categoryColor }}
          />
        </div>
      </div>

      <div className="bg-[#1E1E1E] rounded-xl overflow-hidden">
        {tasks.length > 0 && (
          <div className="px-3 py-1">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                categoryColor={categoryColor}
                currentUserId={currentUserId}
                onToggle={(id) => onToggleTask(id, task.completed)}
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
          </div>
        )}

        {isAdding && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1A1A1A] animate-in fade-in slide-in-from-top-1 duration-200">
            <button
              className="flex-shrink-0 text-gray-500 hover:text-white transition-colors"
              onClick={handleAdd}
            >
              <Plus size={16} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!newTaskTitle.trim()) {
                  setIsAdding(false);
                }
              }}
              placeholder={`Add a task to ${categoryName}...`}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};