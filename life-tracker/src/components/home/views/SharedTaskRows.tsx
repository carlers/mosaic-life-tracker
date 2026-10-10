import React, { useState } from 'react';
import type { CategoryDocument } from '../../../db/schema';
import { Copy, Pencil, CalendarDays, FolderInput } from 'lucide-react';
import { MoreHorizontal, UsersRound, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/react';
import { TaskRowDropSurface } from './TaskReorderSurfaces';
import { BottomSheet } from '../../ui/BottomSheet';
import { useOptionalFriendList } from '../../../hooks/useFriends';
import type {
  SharedCompletionCommand, SharedTaskItem,
} from '../../../lib/taskShareQueue';

const SharedDragRow: React.FC<{ item: SharedTaskItem; categoryId: string;
  children: React.ReactNode }> = ({ item, categoryId, children }) => {
  const { ref, handleRef } = useDraggable({ id: item.id, type: 'task' });
  const content = (
    <div ref={ref} className="relative">
      {children}
      <button type="button" ref={handleRef}
        aria-label={'Drag shared task ' + item.title}
        className="absolute right-10 top-2 rounded p-1 text-gray-500 touch-none">
        <GripVertical size={16} />
      </button>
    </div>
  );
  return categoryId ? (
    <TaskRowDropSurface categoryId={categoryId} taskId={item.id}>{content}</TaskRowDropSurface>
  ) : content;
};

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
}

export const SharedTaskRows: React.FC<SharedTaskRowsProps> = ({
  items, onSetCompleted, pendingFor, showDate = false, onLeave, categories = [],
  categoryFor, onAssignCategory, onCopy, onEditTitle, onChangeDate, compact = false, draggable = false,
}) => {
  const friends = useOptionalFriendList();
  const [selected, setSelected] = useState<SharedTaskItem | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  if (!items.length) return null;
  return (
    <section aria-label="Shared tasks" className={compact ? "min-w-0 space-y-1" : "mt-3 min-w-0 space-y-2"}>
      {!compact && <h3 className="flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <UsersRound size={13} aria-hidden="true" /> Shared with me
      </h3>}
      {items.map(item => {
        const pending = pendingFor(item.taskId);
        const owner = friends.find(friend => friend.friendId === item.ownerId);
        const row = (
          <div key={item.id} className={compact ? "flex min-w-0 items-center gap-3 rounded-lg px-1 py-2" : "flex min-w-0 items-center gap-3 rounded-xl bg-surfaceHighlight p-3"}>
            <button type="button"
              aria-pressed={pending?.completed ?? item.completed}
              aria-label={`${(pending?.completed ?? item.completed) ? 'Mark incomplete' : 'Mark complete'}: ${item.title}`}
              disabled={Boolean(pending)}
              onClick={() => void onSetCompleted(item, !item.completed)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#444444] bg-surface text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-emerald-500">
              {(pending?.completed ?? item.completed) ? '✓' : ''}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{item.title}</p>
              <p className="truncate text-xs text-gray-400">
                Shared by {owner?.friendDisplayName || owner?.friendUsername || 'friend'}
                {showDate ? ` · ${item.date}` : ''}
              </p>
              {pending && (
                <p className="text-xs text-amber-400" role="status">
                  Pending sync · not yet confirmed
                </p>
              )}
            </div>
            {onLeave && (
              <button type="button" onClick={() => { setFeedback(''); setTitleInput(item.title); setDateInput(item.date); setCategoryInput(categoryFor?.(item) || ''); setSelected(item); }}
                aria-label={'Manage shared task ' + item.title}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 focus-visible:outline-2 focus-visible:outline-emerald-500">
                <MoreHorizontal size={18} />
              </button>
            )}
          </div>
        );
        return draggable ? (
          <SharedDragRow key={item.id} item={item} categoryId={categoryFor?.(item) || ''}>
            {row}
          </SharedDragRow>
        ) : row;
      })}
      {onLeave && <BottomSheet isOpen={Boolean(selected)} onClose={() => setSelected(null)}
        title="Shared task" height="auto">
        <div className="space-y-3 px-4 pb-8 pt-2">
          <p className="text-sm">{selected?.title}</p>
          <p className="text-xs text-gray-400">Shared by {friends.find(f => f.friendId === selected?.ownerId)?.friendDisplayName ||
            friends.find(f => f.friendId === selected?.ownerId)?.friendUsername || 'a friend'}. The owner keeps memo, photos, and private category. Editable shared fields depend on permissions.</p>
          {feedback && <p role="status" className="text-sm text-gray-400">{feedback}</p>}
          {selected && (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="flex items-center gap-2 text-gray-300"><FolderInput size={15} /> My category</span>
                <select aria-label="Assign shared task to my category"
                  className="mt-1 w-full rounded-lg bg-surfaceHighlight p-2 text-white"
                  value={categoryInput} disabled={editBusy}
                  onChange={event => {
                    const value = event.target.value;
                    setCategoryInput(value);
                    if (onAssignCategory) void onAssignCategory(selected, value)
                      .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Could not assign category.'));
                  }}>
                  <option value="">Shared with me (unassigned)</option>
                  {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <button type="button" disabled={!onCopy || editBusy || categories.length === 0}
                className="flex w-full items-center gap-2 rounded-lg bg-surfaceHighlight p-3 text-left text-sm disabled:opacity-50"
                onClick={() => {
                  if (!onCopy) return;
                  setEditBusy(true);
                  void onCopy(selected, categoryInput || categories[0].id)
                    .then(() => setFeedback('Independent copy created in your tasks.'))
                    .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Copy failed.'))
                    .finally(() => setEditBusy(false));
                }}><Copy size={16} /> Duplicate as my own task</button>
              <label className="block text-sm">
                <span className="flex items-center gap-2 text-gray-300"><Pencil size={15} /> Shared title {selected.allowTitleEdit ? '' : '· owner only'}</span>
                <input type="text" aria-label="Edit shared title" maxLength={255}
                  className="mt-1 w-full rounded-lg bg-surfaceHighlight p-2 text-white"
                  value={titleInput} disabled={!selected.allowTitleEdit || editBusy}
                  onChange={event => setTitleInput(event.target.value)} />
              </label>
              {selected.allowTitleEdit && onEditTitle && titleInput.trim() !== selected.title && (
                <button type="button" disabled={!titleInput.trim() || editBusy}
                  className="w-full rounded-lg bg-surfaceHighlight p-2 text-sm"
                  onClick={() => {
                    setEditBusy(true);
                    void onEditTitle(selected, titleInput.trim()).then(() => { setSelected(null); })
                      .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Edit failed.'))
                      .finally(() => setEditBusy(false));
                  }}>Save shared title for everyone</button>
              )}
              <label className="block text-sm">
                <span className="flex items-center gap-2 text-gray-300"><CalendarDays size={15} /> Shared date {selected.allowDateEdit ? '' : '· owner only'}</span>
                <input type="date" aria-label="Change shared date"
                  className="mt-1 w-full rounded-lg bg-surfaceHighlight p-2 text-white"
                  value={dateInput} disabled={!selected.allowDateEdit || editBusy}
                  onChange={event => setDateInput(event.target.value)} />
              </label>
              {selected.allowDateEdit && onChangeDate && dateInput !== selected.date && (
                <button type="button" disabled={!dateInput || editBusy}
                  className="w-full rounded-lg bg-surfaceHighlight p-2 text-sm"
                  onClick={() => {
                    setEditBusy(true);
                    void onChangeDate(selected, dateInput).then(() => setSelected(null))
                      .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Date change failed.'))
                      .finally(() => setEditBusy(false));
                  }}>Change date for everyone</button>
              )}
            </div>
          )}
          <button type="button" disabled={!selected || leaving || editBusy}
            className="w-full rounded-lg bg-surfaceHighlight p-3 text-left text-sm disabled:opacity-50"
            onClick={() => {
              if (!selected) return;
              setLeaving(true);
              void Promise.resolve(onLeave(selected)).then(() => setSelected(null))
                .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Could not leave task.'))
                .finally(() => setLeaving(false));
            }}>Leave shared task</button>
        </div>
      </BottomSheet>}
    </section>
  );
};
