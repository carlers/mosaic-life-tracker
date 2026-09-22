import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { useImageLoadGate } from '../../../hooks/useImageLoadGate';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { useBubbleGestures } from '../../../hooks/useBubbleGestures';
import { ReactionRow } from '../../messages/ReactionRow';
import { parseReactions } from '../../../lib/reactionUtils';
import { getReadableTextColor } from '../../../constants/colors';
import type { TaskDocument } from '../../../db/schema';

type MemoOpenMode = 'view' | 'edit';

interface TaskItemProps {
  task: TaskDocument;
  categoryColor: string;
  currentUserId: string;
  onToggle: (taskId: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument, mode: MemoOpenMode) => void;
  onEditStart: (task: TaskDocument) => void;
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
  onEditStart,
  onViewImage,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
}) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLDivElement>();
  const { imageUrl, isLoading } = useTaskImage(task.image, shouldLoad);
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
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const titleGestures = useBubbleGestures({
    disabled: isEditing,
    onSingleTap: () => onOpenActions(task),
    onDoubleTap: () => onEditStart(task),
    onTripleTap: () => onOpenMemo(task, 'edit'),
  });
  const memoGestures = useBubbleGestures({
    onSingleTap: () => onOpenMemo(task, 'view'),
    onDoubleTap: () => onOpenMemo(task, 'edit'),
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEditCancel();
    }
  };
  const isCompleted = task.completed;

  return (
    <motion.div ref={targetRef} layout className="flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        style={{
          borderColor: isCompleted ? categoryColor : '#4B5563',
          backgroundColor: isCompleted ? categoryColor : 'transparent',
        }}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted && (
          <Check size={12} style={{ color: getReadableTextColor(categoryColor) }} aria-hidden="true" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onEditSave}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-white outline-none border-b border-[#4B5563] focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Task title"
          />
        ) : (
          <button
            type="button"
            {...titleGestures}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail === 0) onOpenActions(task);
            }}
            className="w-full touch-pan-y text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label={task.title}
          >
            <span className={isCompleted ? 'line-through text-gray-400' : 'text-white'}>
              {task.title}
            </span>
          </button>
        )}
        {task.memo && (
          <button
            type="button"
            {...memoGestures}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail === 0) onOpenMemo(task, 'view');
            }}
            className="mt-1 flex w-full touch-pan-y items-start gap-1 text-left text-xs text-gray-400 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Open memo"
          >
            <FileText size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="whitespace-pre-wrap break-words">{task.memo}</span>
          </button>
        )}
        {task.image &&
          (imageUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewImage?.(task);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-2 block w-full aspect-[16/9] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              aria-label="View image"
            >
              <img src={imageUrl} alt={task.title} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-xl" />
            </button>
          ) : (
            <div aria-hidden="true" className={`mt-2 w-full aspect-[16/9] rounded-xl bg-gray-500/20 ${isLoading ? 'animate-pulse' : ''}`} />
          ))}
        {reactions.length > 0 && (
          <div className="mt-1">
            <ReactionRow reactions={reactions} currentUserId={currentUserId} isOutgoing={false} onToggle={() => {}} />
          </div>
        )}
      </div>
    </motion.div>
  );
};
