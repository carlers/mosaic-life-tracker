import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { ReactionRow } from '../../messages/ReactionRow';
import { parseReactions } from '../../../lib/reactionUtils';
import type { TaskDocument } from '../../../db/schema';

interface TaskItemProps {
  task: TaskDocument;
  categoryColor: string;
  currentUserId: string;
  onToggle: (taskId: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument) => void;
  onViewImage?: (task: TaskDocument) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  categoryColor,
  currentUserId,
  onToggle,
  onOpenActions,
  onOpenMemo,
  onViewImage,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
}) => {
  const { imageUrl } = useTaskImage(task.image);
  const reactions = React.useMemo(
    () => parseReactions(task.reactions),
    [task.reactions]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [syncedTaskId, setSyncedTaskId] = useState<string | null>(null);

  if (isEditing && task.id !== syncedTaskId) {
    setSyncedTaskId(task.id);
  } else if (!isEditing && syncedTaskId !== null) {
    setSyncedTaskId(null);
  }

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleEditSave = () => {
    onEditSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEditCancel();
    }
  };

  const isCompleted = task.completed;

  return (
    <motion.div
      layout
      className="flex items-start gap-3 py-2"
    >
      <button
        onClick={() => onToggle(task.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center"
        style={{
          borderColor: isCompleted ? categoryColor : '#4B5563',
          backgroundColor: isCompleted ? categoryColor : 'transparent',
        }}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted && <Check size={12} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleEditSave}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-white outline-none border-b border-[#4B5563]"
          />
        ) : (
          <button
            onClick={() => onOpenActions(task)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full text-left"
          >
            <span
              className={
                isCompleted
                  ? 'line-through text-gray-500'
                  : 'text-white'
              }
            >
              {task.title}
            </span>
          </button>
        )}
        {task.memo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenMemo(task);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 flex items-center gap-1 text-xs text-gray-500"
            aria-label="Open memo"
          >
            <FileText size={12} />
            <span>Memo</span>
          </button>
        )}
        {task.image && imageUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewImage?.(task);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 block"
            aria-label="View image"
          >
            <img
              src={imageUrl}
              alt={task.title}
              className="w-16 h-16 object-cover rounded-lg"
            />
          </button>
        )}
        {reactions.length > 0 && (
          <div className="mt-1">
            <ReactionRow
              reactions={reactions}
              currentUserId={currentUserId}
              isOutgoing={false}
              onToggle={() => {}}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};
