import React from 'react';
import { motion } from 'framer-motion';
import { Check, FileText, Image as ImageIcon } from 'lucide-react';
import type { TaskDocument } from '../../../db/schema';

interface TaskItemProps {
  task: TaskDocument;
  categoryColor: string;
  onToggle: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, categoryColor, onToggle }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-2.5 border-b border-[#333333] last:border-0 group"
    >
      {/* Custom Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
        style={{ 
          backgroundColor: task.completed ? categoryColor : 'transparent',
          borderColor: task.completed ? categoryColor : '#333333'
        }}
      >
        {task.completed && <Check size={12} className="text-white" strokeWidth={3} />}
      </button>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
          {task.title}
        </p>
      </div>

      {/* Indicators (Memo / Image) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.memo && (
          <FileText size={14} className="text-gray-600" />
        )}
        {task.image && (
          <ImageIcon size={14} className="text-gray-600" />
        )}
      </div>
    </motion.div>
  );
};