import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { getImageAsBlobUrl } from '../../../lib/storage';
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
  const [imageBlobUrl, setImageBlobUrl] = useState<string>('');

  useEffect(() => {
    if (task.image && task.image.trim() !== '') {
      getImageAsBlobUrl(task.image)
        .then(url => setImageBlobUrl(url))
        .catch(err => console.error('[TaskItem] Failed to load image:', err));
    } else {
      setImageBlobUrl('');
    }

    return () => {
      if (imageBlobUrl) {
        URL.revokeObjectURL(imageBlobUrl);
      }
    };
  }, [task.image]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-2.5 group"
    >
      <div className="flex items-start gap-3">
        {/* Custom Checkbox */}
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
            <div onClick={() => onOpenActions(task)} onPointerDown={(e) => e.stopPropagation()}>
              <p className={`text-base ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                {task.title}
              </p>
              {/* Memo Display */}
              {task.memo && (
                <p
                  className="text-sm text-gray-400 mt-1 cursor-pointer hover:text-gray-300 transition-colors whitespace-pre-wrap"
                  onClick={(e) => { e.stopPropagation(); onOpenMemo(task); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {task.memo}
                </p>
              )}
              {/* Image Thumbnail */}
              {task.image && imageBlobUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img 
                    src={imageBlobUrl} 
                    alt="Task attachment"
                    className="w-12 h-12 rounded-lg object-cover border border-[#333333]"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Indicators */}
        {!isEditing && (
          <div className="flex items-center gap-2 flex-shrink-0 pointer-events-none">
            {task.memo && !task.image && (
              <FileText size={14} className="text-gray-600" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};