import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskItem } from './TaskItem';
import type { TaskDocument } from '../../../db/schema';

interface CategorySectionProps {
  categoryName: string;
  categoryColor: string;
  tasks: TaskDocument[];
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ 
  categoryName, 
  categoryColor, 
  tasks, 
  onToggleTask,
  onAddTask
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      onAddTask(newTaskTitle.trim());
      setNewTaskTitle('');
    }
  };

  return (
    <div className="mb-4">
      {/* Category Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div 
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: categoryColor }}
        />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {categoryName}
        </h3>
        <span className="text-[10px] text-gray-600 ml-auto">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Task List Container */}
      <div className="bg-[#1E1E1E] rounded-xl border border-[#333333] overflow-hidden">
        {tasks.length > 0 && (
          <div className="px-3 py-1">
            {tasks.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                categoryColor={categoryColor}
                onToggle={(id) => onToggleTask(id, task.completed)} 
              />
            ))}
          </div>
        )}

        {/* Inline Add Task Input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#333333] bg-[#1A1A1A]">
          <button 
            className="flex-shrink-0 text-gray-500 hover:text-white transition-colors"
            onClick={() => {
              if (newTaskTitle.trim()) {
                onAddTask(newTaskTitle.trim());
                setNewTaskTitle('');
              }
            }}
          >
            <Plus size={16} />
          </button>
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Add a task to ${categoryName}...`}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};