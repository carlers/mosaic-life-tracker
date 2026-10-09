import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useImageLoadGate } from '../../../hooks/useImageLoadGate';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { useBubbleGestures } from '../../../hooks/useBubbleGestures';
import { activateOnEnterOrSpace } from '../../../lib/keyboardActivation';
import { ReactionRow } from '../../messages/ReactionRow';
import { parseReactions } from '../../../lib/reactionUtils';
import type { TaskDocument } from '../../../db/schema';

type MemoOpenMode = 'view' | 'edit';

export interface TaskItemProps {
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
  disableLayoutAnimation?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  titleRef?: React.Ref<HTMLButtonElement>;
  isDragOverlay?: boolean;
}

interface TaskImageProps {
  task: TaskDocument;
  onViewImage?: (task: TaskDocument) => void;
  selectionMode?: boolean;
  onSelect?: () => void;
}

const TASK_TAP_DISAMBIGUATION_WINDOW = 200;

const TaskImage: React.FC<TaskImageProps> = ({ task, onViewImage, selectionMode, onSelect }) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLElement>();
  const { imageUrl, isLoading } = useTaskImage(task.image, shouldLoad);

  if (imageUrl) {
    return (
      <button
        ref={targetRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (selectionMode) onSelect?.();
          else onViewImage?.(task);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-2 block w-full aspect-[16/9] rounded-xl focus:outline-none"
        aria-label="View image"
      >
        <img
          src={imageUrl}
          alt={task.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover rounded-xl"
        />
      </button>
    );
  }

  return (
    <div
      ref={targetRef}
      aria-hidden="true"
      className={`mt-2 w-full aspect-[16/9] rounded-xl bg-gray-500/20 ${isLoading ? 'animate-pulse' : ''}`}
    />
  );
};

const TaskMemo: React.FC<{
  task: TaskDocument;
  onOpenMemo: (task: TaskDocument, mode: MemoOpenMode) => void;
  selectionMode?: boolean;
  onSelect?: () => void;
}> = ({ task, onOpenMemo, selectionMode, onSelect }) => {
  const memoGestures = useBubbleGestures({
    disabled: selectionMode,
    doubleTapWindow: TASK_TAP_DISAMBIGUATION_WINDOW,
    onSingleTap: () => onOpenMemo(task, 'view'),
    onDoubleTap: () => onOpenMemo(task, 'edit'),
  });

  return (
    <button
      type="button"
      onPointerDown={memoGestures.onPointerDown}
      onPointerMove={memoGestures.onPointerMove}
      onPointerUp={memoGestures.onPointerUp}
      onPointerCancel={memoGestures.onPointerCancel}
      onContextMenu={memoGestures.onContextMenu}
      onClick={(event) => {
        event.stopPropagation();
        if (selectionMode) onSelect?.();
        else if (event.detail === 0) onOpenMemo(task, 'view');
      }}
      data-day-swipe-through="true"
      className="mt-1 w-full touch-pan-y text-left text-xs text-gray-400 rounded focus:outline-none"
      aria-label="Open memo"
    >
      <span className="whitespace-pre-wrap break-words">{task.memo}</span>
    </button>
  );
};

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
  disableLayoutAnimation = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
  titleRef,
  isDragOverlay = false,
}) => {
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
    disabled: isEditing || selectionMode,
    doubleTapWindow: TASK_TAP_DISAMBIGUATION_WINDOW,
    onSingleTap: () => onOpenActions(task),
    onDoubleTap: () => onEditStart(task),
    onTripleTap: () => onOpenMemo(task, 'edit'),
    deferTripleTap: true,
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
    <motion.div
      layout={!disableLayoutAnimation}
      layoutDependency={`${task.updatedAt}:${isEditing}`}
      data-task-id={isDragOverlay ? undefined : task.id}
      data-task-overlay-id={isDragOverlay ? task.id : undefined}
      data-task-dragging={isDragOverlay ? 'true' : undefined}
      role={!isDragOverlay && selectionMode ? 'checkbox' : undefined}
      aria-checked={!isDragOverlay && selectionMode ? isSelected : undefined}
      aria-label={
        !isDragOverlay && selectionMode
          ? `${task.title}, ${isSelected ? 'selected' : 'not selected'}`
          : undefined
      }
      aria-hidden={isDragOverlay ? true : undefined}
      tabIndex={!isDragOverlay && selectionMode ? 0 : undefined}
      onClick={selectionMode ? onToggleSelection : undefined}
      onKeyDown={selectionMode ? (event) => {
        activateOnEnterOrSpace(event, () => onToggleSelection?.());
      } : undefined}
      className="flex scroll-mt-16 items-start gap-3 rounded-lg pl-0 pr-2 py-2 transition-[background-color,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 data-[search-focused=true]:ring-1 data-[search-focused=true]:ring-emerald-400/60"
      style={
        isDragOverlay
          ? {
              backgroundColor: 'var(--mosaic-bg)',
              boxShadow: '0 14px 36px rgba(0, 0, 0, 0.38)',
              pointerEvents: 'none',
            }
          : isSelected
            ? { backgroundColor: `${categoryColor}33` }
            : undefined
      }
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(task.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center focus:outline-none"
        style={{
          borderColor: isCompleted ? categoryColor : '#4B5563',
          backgroundColor: isCompleted ? categoryColor : 'transparent',
        }}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted && (
          <Check
            size={15}
            strokeWidth={4}
            style={{ color: '#fff' }}
            className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
            aria-hidden="true"
          />
        )}
      </button>
      <div className="flex-1 min-w-0">
        {isEditing && !selectionMode ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onEditSave}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-white outline-none border-b border-[#4B5563]"
            style={{ borderBottomColor: categoryColor, borderBottomWidth: '2px' }}
            aria-label="Task title"
          />
        ) : (
          <button
            ref={titleRef}
            type="button"
            onPointerDown={titleGestures.onPointerDown}
            onPointerMove={titleGestures.onPointerMove}
            onPointerUp={titleGestures.onPointerUp}
            onPointerCancel={titleGestures.onPointerCancel}
            onContextMenu={titleGestures.onContextMenu}
            onClick={(event) => {
              event.stopPropagation();
              if (selectionMode) onToggleSelection?.();
              else if (event.detail === 0) onOpenActions(task);
            }}
            data-day-swipe-through="true"
            className="w-full touch-pan-y text-left rounded focus:outline-none"
            aria-label={task.title}
          >
            <span className={isCompleted ? 'line-through text-gray-400' : 'text-white'}>
              {task.title}
            </span>
          </button>
        )}
        {task.memo && (
          <TaskMemo task={task} onOpenMemo={onOpenMemo} selectionMode={selectionMode} onSelect={onToggleSelection} />
        )}
        {task.image && (
          <TaskImage task={task} onViewImage={onViewImage} selectionMode={selectionMode} onSelect={onToggleSelection} />
        )}
        {reactions.length > 0 && (
          <div className={`mt-1 ${selectionMode ? 'pointer-events-none' : ''}`}>
            <ReactionRow reactions={reactions} currentUserId={currentUserId} isOutgoing={false} onToggle={() => { }} />
          </div>
        )}
      </div>
    </motion.div>
  );
};
