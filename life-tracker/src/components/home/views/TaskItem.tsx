import React from 'react';
import { motion } from 'framer-motion';
import { Check, Image as ImageIcon } from 'lucide-react';
import type { TaskDocument } from '../../../db/schema';

interface TaskItemProps {
  task: TaskDocument;
  categoryColor: string;
  onToggle: (taskId: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  categoryColor, 
  onToggle, 
  onOpenActions, 
  onOpenMemo,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-2.5 group"
    >
      <div className="flex items-start gap-3">
        {/* Custom Checkbox - Always visible and functional */}
        <button
          onClick={() => onToggle(task.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-1"
          style={{ 
            backgroundColor: task.completed ? categoryColor : 'transparent',
            borderColor: task.completed ? categoryColor : '#333333'
          }}
        >
          {task.completed && <Check size={12} className="text-white" strokeWidth={3} />}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave();
                if (e.key === 'Escape') onEditCancel();
              }}
              autoFocus
              className="w-full bg-transparent text-base text-white focus:outline-none border-b border-blue-500 pb-1"
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <p 
              className={`text-base ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}
              onClick={() => onOpenActions(task)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {task.title}
            </p>
          )}
          
          {/* Memo Display - Only show if not editing */}
          {!isEditing && task.memo && (
            <p
              className="text-sm text-gray-400 mt-1 cursor-pointer hover:text-gray-300 transition-colors whitespace-pre-wrap"
              onClick={() => onOpenMemo(task)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {task.memo}
            </p>
          )}
        </div>

        {/* Indicators (Image) */}
        {!isEditing && (
          <div className="flex items-center gap-2 flex-shrink-0 pointer-events-none">
            {task.image && (
              <ImageIcon size={14} className="text-gray-600" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};