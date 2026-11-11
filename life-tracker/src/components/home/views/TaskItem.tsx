import React, { useEffect, useRef, useState } from 'react';
import {
  blurTaskInputAfterCompletion, getFocusedTaskCheckboxPreferences,
  markTaskCheckboxIntent, shouldRetainTitleEditorOnBlur, useFocusedEditCheckboxTap,
  type DeferredTaskCheckboxBlur,
} from './taskCheckboxPreferences';
import { motion } from 'framer-motion';
import { Check, UsersRound } from 'lucide-react';
import { TaskTimestampMeta } from './TaskTimestampMeta';
import type { TaskTimestampDisplay } from '../../../lib/taskTimeline';
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
  shareLabel?: string;
  timestampDisplay?: TaskTimestampDisplay;
  currentUserId: string;
  onToggle: (taskId: string) => void | Promise<unknown>;
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
  /** Allow the surrounding Timeline drag handle to receive long-presses. */
  allowParentDrag?: boolean;
}

interface TaskImageProps {
  task: TaskDocument;
  allowParentDrag?: boolean;
  onViewImage?: (task: TaskDocument) => void;
  selectionMode?: boolean;
  onSelect?: () => void;
}

const TASK_TAP_DISAMBIGUATION_WINDOW = 200;

const TaskImage: React.FC<TaskImageProps> = ({ task, onViewImage, selectionMode, onSelect, allowParentDrag = false }) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLElement>();
  const { imageUrl, isLoading, retryImage, handleImageError } = useTaskImage(task.image, shouldLoad);

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
        onPointerDown={(e) => { if (!allowParentDrag) e.stopPropagation(); }}
        className="mt-2 block w-full aspect-[16/9] rounded-xl focus:outline-none"
        aria-label="View image"
      >
        <img
          src={imageUrl}
          alt={task.title}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onError={handleImageError}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain rounded-xl"
        />
      </button>
    );
  }

  if (!isLoading && shouldLoad && task.image) {
    return (
      <button
        ref={targetRef}
        type="button"
        aria-label="Retry unavailable photo"
        onClick={(event) => { event.stopPropagation(); retryImage(); }}
        onPointerDown={(event) => { if (!allowParentDrag) event.stopPropagation(); }}
        className="mt-2 flex w-full aspect-[16/9] items-center justify-center rounded-xl bg-gray-500/20 text-xs text-gray-400 focus-visible:outline"
      >
        Photo unavailable · Retry
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
  shareLabel,
  timestampDisplay,
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
  allowParentDrag = false,
}) => {
  const reactions = React.useMemo(
    () => parseReactions(task.reactions),
    [task.reactions]
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressCompletionClickRef = useRef(false);
  const blurInputAfterCompletionRef = useRef<DeferredTaskCheckboxBlur | null>(null);
  const editCheckboxTap = useFocusedEditCheckboxTap('owned:' + task.id, () => onToggle(task.id));
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
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEditCancel();
    }
  };
  const isCompleted = task.completed;
  const frameStyle: React.CSSProperties | undefined = isDragOverlay
    ? {
        backgroundColor: 'var(--mosaic-bg)',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.38)',
        pointerEvents: 'none',
      }
    : isSelected
      ? { backgroundColor: `${categoryColor}33` }
      : undefined;

  const frameProps = {
    'data-task-id': isDragOverlay ? undefined : task.id,
    'data-task-overlay-id': isDragOverlay ? task.id : undefined,
    'data-task-dragging': isDragOverlay ? 'true' : undefined,
    role: !isDragOverlay && selectionMode ? ('checkbox' as const) : undefined,
    'aria-checked': !isDragOverlay && selectionMode ? isSelected : undefined,
    'aria-label': !isDragOverlay && selectionMode
      ? `${task.title}, ${isSelected ? 'selected' : 'not selected'}`
      : undefined,
    'aria-hidden': isDragOverlay ? (true as const) : undefined,
    tabIndex: !isDragOverlay && selectionMode ? 0 : undefined,
    onClick: selectionMode ? onToggleSelection : undefined,
    onKeyDown: selectionMode ? (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      activateOnEnterOrSpace(event, () => onToggleSelection?.());
    } : undefined,
    className: 'flex scroll-mt-16 items-start gap-3 rounded-lg pl-0 pr-2 py-2 transition-[background-color,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 data-[search-focused=true]:ring-1 data-[search-focused=true]:ring-emerald-400/60',
    style: frameStyle,
  };

  const rowContent = (
    <>
      <button
        type="button"
        data-task-completion-id={isDragOverlay ? undefined : task.id}
        data-task-completion-color={categoryColor}
        onClick={(event) => {
          event.stopPropagation();
          if (editCheckboxTap.consumeClick()) return;
          const focusedInput = event.detail === 0 ? null : getFocusedTaskCheckboxPreferences();
          const shouldSuppress = suppressCompletionClickRef.current ||
            (focusedInput !== null && focusedInput.rowKey !== `owned:${task.id}` && !focusedInput.allowCheckboxes);
          const inputToBlur = blurInputAfterCompletionRef.current;
          suppressCompletionClickRef.current = false;
          blurInputAfterCompletionRef.current = null;

          const completionAction = !shouldSuppress && !selectionMode ? onToggle(task.id) : undefined;
          if (inputToBlur) {
            const blurInput = () => blurTaskInputAfterCompletion(inputToBlur);
            if (completionAction && typeof completionAction.then === 'function') {
              // A newer checkbox gesture supersedes this deferred blur.
              void Promise.resolve(completionAction).then(blurInput, blurInput);
            } else blurInput();
          }
        }}
        onPointerDown={(event) => {
          if (!allowParentDrag) event.stopPropagation();
          const focusedInput = getFocusedTaskCheckboxPreferences();
          const intentRevision = markTaskCheckboxIntent(focusedInput?.input);
          if (editCheckboxTap.onPointerDown(event)) {
            suppressCompletionClickRef.current = false;
            blurInputAfterCompletionRef.current = null;
            return;
          }
          suppressCompletionClickRef.current = false;
          blurInputAfterCompletionRef.current = null;

          if (focusedInput && focusedInput.rowKey !== `owned:${task.id}`) {
            suppressCompletionClickRef.current = !focusedInput.allowCheckboxes;
            if (!focusedInput.keepInputFocused) {
              blurInputAfterCompletionRef.current = { input: focusedInput.input, revision: intentRevision };
            }
            // Keep the click target mounted and actionable until its click handler runs.
            event.preventDefault();
          } else if (isEditing || focusedInput) {
            // Preserve the legacy same-task editor behavior and non-Day-View inputs.
            event.preventDefault();
          }
        }}
        onPointerMove={editCheckboxTap.onPointerMove}
        onPointerUp={editCheckboxTap.onPointerUp}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') editCheckboxTap.cancel();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            editCheckboxTap.resetKeyboard();
            suppressCompletionClickRef.current = false;
            blurInputAfterCompletionRef.current = null;
          }
        }}
        onPointerCancel={() => {
          editCheckboxTap.cancel();
          suppressCompletionClickRef.current = false;
          blurInputAfterCompletionRef.current = null;
        }}
        className="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center focus:outline-none"
        style={{
          borderColor: isCompleted ? categoryColor : '#4B5563',
          backgroundColor: isCompleted ? categoryColor : 'transparent',
        }}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        aria-disabled={selectionMode || undefined}
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
            data-task-inline-input
            data-task-inline-row-key={`owned:${task.id}`}
            type="text"
            enterKeyHint="done"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
              if (!shouldRetainTitleEditorOnBlur(event.currentTarget)) onEditSave();
            }}
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
            data-day-keyboard-target="task"
            data-day-keyboard-id={task.id}
            aria-keyshortcuts={selectionMode ? 'Enter Space' : 'Enter Space Shift+Enter'}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                if (selectionMode) onToggleSelection?.();
                else if (event.shiftKey) onOpenActions(task);
                else onEditStart(task);
              } else if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                event.stopPropagation();
                if (selectionMode) onToggleSelection?.();
                else onToggle(task.id);
              }
            }}
            className="w-full touch-pan-y text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label={task.title}
          >
            <span className={isCompleted ? 'line-through text-gray-400' : 'text-white'}>
              {task.title}
            </span>
          </button>
        )}
        {shareLabel && !selectionMode && (
          <p title={shareLabel} className="mt-1 flex min-w-0 items-center gap-1 text-xs text-gray-400">
            <UsersRound size={12} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{shareLabel}</span>
          </p>
        )}
        {timestampDisplay && (timestampDisplay.showCreated || timestampDisplay.showCompleted) && (
          <TaskTimestampMeta task={task} display={timestampDisplay} />
        )}
        {task.memo && (
          <TaskMemo task={task} onOpenMemo={onOpenMemo} selectionMode={selectionMode} onSelect={onToggleSelection} />
        )}
        {task.image && (
          <TaskImage task={task} onViewImage={onViewImage} selectionMode={selectionMode} onSelect={onToggleSelection} allowParentDrag={allowParentDrag} />
        )}
        {reactions.length > 0 && (
          <div className={`mt-1 ${selectionMode ? 'pointer-events-none' : ''}`}>
            <ReactionRow reactions={reactions} currentUserId={currentUserId} isOutgoing={false} onToggle={() => { }} />
          </div>
        )}
      </div>
    </>
  );

  // Static task rows do not need Motion measurement. Keep the original
  // Motion wrapper for the dragged overlay and every animated presentation.
  return disableLayoutAnimation && !isDragOverlay ? (
    <div {...frameProps}>{rowContent}</div>
  ) : (
    <motion.div {...frameProps} layout={!disableLayoutAnimation}
      layoutDependency={`${task.updatedAt}:${isEditing}`}>
      {rowContent}
    </motion.div>
  );
};
