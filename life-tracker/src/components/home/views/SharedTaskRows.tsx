import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { CalendarDays, Check, Copy, FolderInput, Pencil, Trash2, UsersRound } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';
import { useBubbleGestures } from '../../../hooks/useBubbleGestures';
import { useOptionalFriendList } from '../../../hooks/useFriends';
import type { SharedCompletionCommand, SharedTaskItem } from '../../../lib/taskShareQueue';
import { BottomSheet } from '../../ui/BottomSheet';
import { TaskDateEditor } from './TaskDateEditor';
import { TaskRowDropSurface } from './TaskReorderSurfaces';

const TASK_TAP_WINDOW = 200;
const SHEET_ACTION_CLASS = 'flex w-full items-center gap-4 rounded-xl px-2 py-3.5 text-left text-white transition-colors hover:bg-surfaceHighlight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';
const SHEET_ICON_CLASS = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full';

interface SharedTaskRowsProps {
  items: SharedTaskItem[];
  onSetCompleted: (item: SharedTaskItem, desired: boolean) => void | Promise<unknown>;
  pendingFor: (taskId: string) => SharedCompletionCommand | undefined;
  showDate?: boolean;
  onLeave?: (item: SharedTaskItem) => void | Promise<unknown>;
  categories?: CategoryDocument[];
  categoryFor?: (item: SharedTaskItem) => string;
  onAssignCategory?: (item: SharedTaskItem, categoryId: string) => Promise<void>;
  onCopy?: (item: SharedTaskItem, categoryId: string) => Promise<void>;
  onEditTitle?: (item: SharedTaskItem, title: string) => Promise<void>;
  onChangeDate?: (item: SharedTaskItem, date: string) => Promise<void>;
  compact?: boolean;
  draggable?: boolean;
  activeDragId?: string | null;
  selectedItem?: SharedTaskItem | null;
  onSelectItem?: (item: SharedTaskItem | null) => void;
  actionsOnly?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
}

interface SharedTaskRowProps {
  item: SharedTaskItem;
  color: string;
  ownerName: string;
  pending?: SharedCompletionCommand;
  showDate: boolean;
  isEditing: boolean;
  editValue: string;
  onEditValue: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditStart: () => void;
  onOpenActions: () => void;
  onToggle: () => void;
  titleRef?: React.Ref<HTMLButtonElement>;
}

const SharedTaskRow: React.FC<SharedTaskRowProps> = ({
  item, color, ownerName, pending, showDate, isEditing, editValue,
  onEditValue, onEditSave, onEditCancel, onEditStart, onOpenActions,
  onToggle, titleRef,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const canEdit = item.allowTitleEdit === true;
  const titleGestures = useBubbleGestures({
    disabled: isEditing,
    doubleTapWindow: TASK_TAP_WINDOW,
    onSingleTap: onOpenActions,
    onDoubleTap: canEdit ? onEditStart : onOpenActions,
  });
  const completed = pending?.completed ?? item.completed;

  return (
    <div data-shared-task-id={item.id}
      className="flex scroll-mt-16 items-start gap-3 rounded-lg pl-0 pr-2 py-2 transition-[background-color,box-shadow] duration-200">
      <button type="button"
        aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
        aria-pressed={completed}
        disabled={Boolean(pending)}
        onPointerDown={event => {
          event.stopPropagation();
          // Same checkbox/editor focus ownership as ordinary task rows.
          if (isEditing) event.preventDefault();
        }}
        onClick={event => { event.stopPropagation(); onToggle(); }}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60"
        style={{
          borderColor: completed ? color : '#4B5563',
          backgroundColor: completed ? color : 'transparent',
        }}>
        {completed && <Check size={15} strokeWidth={4} style={{ color: '#fff' }}
          className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input ref={inputRef} type="text" maxLength={255}
            aria-label="Shared task title"
            value={editValue}
            onChange={event => onEditValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); onEditSave(); }
              if (event.key === 'Escape') { event.preventDefault(); onEditCancel(); }
            }}
            onBlur={onEditSave}
            onPointerDown={event => event.stopPropagation()}
            className="w-full border-b-2 bg-transparent text-white outline-none"
            style={{ borderBottomColor: color }}
          />
        ) : (
          <button ref={titleRef} type="button"
            aria-label={item.title}
            data-day-swipe-through="true"
            onPointerDown={titleGestures.onPointerDown}
            onPointerMove={titleGestures.onPointerMove}
            onPointerUp={titleGestures.onPointerUp}
            onPointerCancel={titleGestures.onPointerCancel}
            onContextMenu={titleGestures.onContextMenu}
            onClick={event => {
              event.stopPropagation();
              if (event.detail === 0) onOpenActions(); // Keyboard activation.
            }}
            className="w-full touch-pan-y rounded text-left focus:outline-none">
            <span className={completed ? 'text-gray-400 line-through' : 'text-white'}>
              {item.title}
            </span>
          </button>
        )}
        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-gray-400">
          <UsersRound size={12} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            Shared by {ownerName}{showDate ? ' · ' + item.date : ''}
          </span>
        </div>
        {pending && <p className="text-xs text-amber-400" role="status">
          Pending sync · not yet confirmed
        </p>}
      </div>
    </div>
  );
};

const SharedDragRow: React.FC<{
  item: SharedTaskItem;
  categoryId: string;
  rowProps: SharedTaskRowProps;
  isActiveSource: boolean;
}> = ({ item, categoryId, rowProps, isActiveSource }) => {
  // Mirror DraggableTaskItem: only the title is a drag handle; no visible grip.
  const { ref, handleRef } = useDraggable({ id: item.id, type: 'task' });
  const content = (
    <div className="relative" style={isActiveSource ? {
      height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none',
    } : undefined}>
      <div ref={ref} aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none',
      }} />
      <SharedTaskRow {...rowProps} titleRef={handleRef} />
    </div>
  );
  return categoryId ? (
    <TaskRowDropSurface categoryId={categoryId} taskId={item.id}
      isActiveSource={isActiveSource}>{content}</TaskRowDropSurface>
  ) : content;
};

export const SharedTaskDragOverlay: React.FC<{
  item: SharedTaskItem;
  color: string;
}> = ({ item, color }) => (
  <div aria-hidden="true"
    className="flex items-start gap-3 rounded-lg py-2 pl-0 pr-2"
    style={{ backgroundColor: 'var(--mosaic-bg)', boxShadow: '0 14px 36px rgba(0,0,0,0.38)', pointerEvents: 'none' }}>
    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2"
      style={{ borderColor: item.completed ? color : '#4B5563',
        backgroundColor: item.completed ? color : 'transparent' }} />
    <div className="min-w-0 flex-1">
      <span className={item.completed ? 'text-gray-400 line-through' : 'text-white'}>{item.title}</span>
      <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
        <UsersRound size={12} /> Shared task
      </div>
    </div>
  </div>
);

export const SharedTaskRows: React.FC<SharedTaskRowsProps> = ({
  items, onSetCompleted, pendingFor, showDate = false, onLeave, categories = [],
  categoryFor, onAssignCategory, onCopy, onEditTitle, onChangeDate,
  compact = false, draggable = false, activeDragId = null,
  selectedItem, onSelectItem, actionsOnly = false, onSheetOpenChange,
}) => {
  const friends = useOptionalFriendList();
  const [localSelected, setLocalSelected] = useState<SharedTaskItem | null>(null);
  const selected = onSelectItem ? selectedItem ?? null : localSelected;
  const setSelected = onSelectItem ?? setLocalSelected;
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dateMode, setDateMode] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const savingRef = useRef(false);
  React.useEffect(() => {
    if (!actionsOnly) return;
    onSheetOpenChange?.(Boolean(selected));
    return () => onSheetOpenChange?.(false);
  }, [actionsOnly, onSheetOpenChange, selected]);
  const editingItem = items.find(item => item.id === editId);

  const openActions = useCallback((item: SharedTaskItem) => {
    setFeedback('');
    setDateMode(false);
    setCategoryInput(categoryFor?.(item) || '');
    setSelected(item);
  }, [categoryFor, setSelected]);

  const startEdit = useCallback((item: SharedTaskItem) => {
    if (!onEditTitle || item.allowTitleEdit !== true) {
      openActions(item);
      return;
    }
    setEditValue(item.title);
    setEditId(item.id);
  }, [onEditTitle, openActions]);

  const cancelEdit = useCallback(() => { setEditId(null); setEditValue(''); }, []);

  const saveEdit = useCallback(() => {
    if (!editingItem || savingRef.current) return;
    const title = editValue.trim();
    if (!title || title === editingItem.title) {
      cancelEdit();
      return;
    }
    savingRef.current = true;
    void Promise.resolve(onEditTitle?.(editingItem, title))
      .then(cancelEdit)
      .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Could not edit shared title.'))
      .finally(() => { savingRef.current = false; });
  }, [editingItem, editValue, onEditTitle, cancelEdit]);

  const runAction = (action: () => Promise<unknown>, success: string, close = false) => {
    setBusy(true);
    setFeedback('');
    void Promise.resolve().then(action)
      .then(() => {
        if (close) setSelected(null);
        else setFeedback(success);
      })
      .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Could not update shared task.'))
      .finally(() => setBusy(false));
  };

  if (!items.length && !selected) return null;
  const current = selected && (items.find(item => item.id === selected.id) || selected);
  const currentOwner = current && friends.find(friend => friend.friendId === current.ownerId);
  const currentOwnerName = currentOwner?.friendDisplayName || currentOwner?.friendUsername || 'a friend';
  return (
    <section aria-label="Shared tasks" className={compact ? 'min-w-0' : 'mt-3 min-w-0'}>
      {!compact && !actionsOnly && <h3 className="flex items-center gap-1 px-0 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <UsersRound size={13} aria-hidden="true" /> Shared with me
      </h3>}
      {!actionsOnly && items.map(item => {
        const owner = friends.find(friend => friend.friendId === item.ownerId);
        const categoryId = categoryFor?.(item) || '';
        const color = categories.find(category => category.id === categoryId)?.color || '#6B7280';
        const rowProps: SharedTaskRowProps = {
          item, color,
          ownerName: owner?.friendDisplayName || owner?.friendUsername || 'a friend',
          pending: pendingFor(item.taskId),
          showDate,
          isEditing: editId === item.id,
          editValue,
          onEditValue: setEditValue,
          onEditSave: saveEdit,
          onEditCancel: cancelEdit,
          onEditStart: () => startEdit(item),
          onOpenActions: () => openActions(item),
          onToggle: () => void onSetCompleted(item, !(pendingFor(item.taskId)?.completed ?? item.completed)),
        };
        return draggable && editId !== item.id ? (
          <SharedDragRow key={item.id} item={item} categoryId={categoryId}
            isActiveSource={activeDragId === item.id} rowProps={rowProps} />
        ) : <SharedTaskRow key={item.id} {...rowProps} />;
      })}
      {onLeave && (actionsOnly || !onSelectItem) && <BottomSheet
        isOpen={Boolean(current)}
        onClose={() => { setDateMode(false); setSelected(null); }}
        onTransientDismiss={() => {
          if (!dateMode) return false;
          setDateMode(false);
          return true;
        }}
        title={dateMode ? 'Change Date' : current?.title || 'Shared task'}
        height="auto" backdropBlur preventDismiss={busy}>
        {current && dateMode && current.allowDateEdit === true && onChangeDate ? (
          <TaskDateEditor key={current.id} initialDate={current.date}
            onCancel={() => setDateMode(false)}
            onSave={async date => {
              await onChangeDate(current, date);
              setDateMode(false);
              setSelected(null);
            }}
          />
        ) : <div className="px-4 pb-8 pt-2">
          <div className="mb-4 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1"><UsersRound size={13} />
              Shared by {currentOwnerName}
            </span>
            <p className="mt-1">The owner keeps private memos, photos, and category. Edit access depends on the owner's permissions.</p>
          </div>
          {feedback && <p role="status" className="mb-3 text-sm text-gray-400">{feedback}</p>}
          {current && <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button type="button"
                disabled={busy || current.allowTitleEdit !== true || !onEditTitle}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surfaceHighlight py-4 text-white transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40"
                onClick={() => {
                  setSelected(null);
                  window.setTimeout(() => startEdit(current), 0);
                }}>
                <Pencil size={20} className="text-blue-400" aria-hidden="true" />
                <span className="text-sm">{current.allowTitleEdit ? 'Edit' : 'Edit · owner only'}</span>
              </button>
              <button type="button" disabled={!onCopy || !categories.length || busy}
                className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surfaceHighlight py-4 text-white transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40"
                onClick={() => {
                  if (!onCopy) return;
                  runAction(() => onCopy(current, categoryInput || categories[0].id), 'Copied to your tasks.');
                }}>
                <Copy size={20} className="text-blue-400" aria-hidden="true" />
                <span className="text-sm">Duplicate</span>
              </button>
            </div>
            <label className="mb-3 block text-sm">
              <span className="flex items-center gap-3"><span className={SHEET_ICON_CLASS + ' bg-surfaceHighlight'}>
                <FolderInput size={16} /></span> My category</span>
              <select aria-label="Assign shared task to my category"
                value={categoryInput} disabled={busy}
                onChange={event => {
                  const id = event.target.value;
                  setCategoryInput(id);
                  if (onAssignCategory) runAction(async () => {
                    try {
                      await onAssignCategory(current, id);
                    } catch (cause) {
                      setCategoryInput(categoryFor?.(current) || '');
                      throw cause;
                    }
                  }, 'Category updated.');
                }}
                className="mt-2 w-full rounded-lg border border-gray-600 bg-surfaceHighlight p-3 text-sm text-white">
                <option value="">Shared with me (unassigned)</option>
                {categories.map(category =>
                  <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <button type="button" className={SHEET_ACTION_CLASS}
              onClick={() => runAction(async () => {
                await navigator.clipboard.writeText(current.title);
              }, 'Task title copied.')}>
              <span className={SHEET_ICON_CLASS + ' bg-gray-300'}><Copy size={16} className="text-black" /></span>
              <span className="text-base font-medium">Copy Task Text</span>
            </button>
            <button type="button" className={SHEET_ACTION_CLASS}
              disabled={!onChangeDate || current.allowDateEdit !== true || busy}
              onClick={() => setDateMode(true)}>
              <span className={SHEET_ICON_CLASS + ' bg-blue-400'}><CalendarDays size={16} className="text-black" /></span>
              <span className="flex-1 text-base font-medium">Change Date</span>
              {current.allowDateEdit !== true && <span className="text-xs text-gray-400">Owner only</span>}
            </button>
            <button type="button" className={SHEET_ACTION_CLASS}
              disabled={busy}
              onClick={() => runAction(() => Promise.resolve(onLeave(current)), 'Left shared task.', true)}>
              <span className={SHEET_ICON_CLASS + ' bg-red-400'}>
                <Trash2 size={16} className="text-black" /></span>
              <span className="text-base font-medium">Leave Shared Task</span>
            </button>
          </>}
        </div>}
      </BottomSheet>}
      {!selected && feedback && <p role="status" className="mt-2 text-sm text-amber-400">{feedback}</p>}
    </section>
  );
};
