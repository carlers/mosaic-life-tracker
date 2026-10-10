import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

type NewTask = Omit<TaskDocument, 'id' | 'userId' | 'order' | 'createdAt' | 'updatedAt' | 'isDeleted'>;

interface BacklogSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  focusTaskId?: string | null;
  onAddTask: (task: NewTask) => Promise<void> | void;
  onUpdateTask: (id: string, updates: Partial<TaskDocument>) => Promise<void> | void;
  onToggleTask: (id: string, completed: boolean) => Promise<void> | void;
}

export const BacklogSheet: React.FC<BacklogSheetProps> = ({
  isOpen, onClose, tasks, categories, focusTaskId,
  onAddTask, onUpdateTask, onToggleTask,
}) => {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const selectedCategoryId = categories.some((c) => c.id === categoryId)
    ? categoryId : (categories[0]?.id ?? '');
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const unscheduled = useMemo(() =>
    tasks.filter((task) => !task.isDeleted && task.date === '')
      .sort((a, b) => Number(a.completed) - Number(b.completed) ||
        (categoryById.get(a.categoryId)?.order ?? 0) - (categoryById.get(b.categoryId)?.order ?? 0) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        b.createdAt.localeCompare(a.createdAt)),
    [tasks, categoryById]
  );
  const effectiveShowCompleted = showCompleted || unscheduled.some((task) => task.id === focusTaskId && task.completed);
  const shown = effectiveShowCompleted ? unscheduled : unscheduled.filter((t) => !t.completed);
  const completedCount = unscheduled.filter((t) => t.completed).length;

  useEffect(() => {
    if (!isOpen || !focusTaskId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('backlog-task-' + focusTaskId)?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, focusTaskId]);

  const perform = async (operation: () => Promise<void> | void) => {
    setWorking(true);
    setError('');
    try {
      await operation();
    } catch {
      setError('Could not save. Your changes were not confirmed; please retry.');
    } finally {
      setWorking(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = title.trim();
    if (!normalized || !selectedCategoryId || working) return;
    await perform(async () => {
      await onAddTask({
        title: normalized, completed: false, completedAt: '',
        categoryId: selectedCategoryId, date: '', visibility: 'private',
        memo: '', image: '', tags: '',
      });
      setTitle('');
    });
  };

  const startEdit = (task: TaskDocument) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditMemo(task.memo ?? '');
  };

  const saveEdit = (id: string) => {
    const normalized = editTitle.trim();
    if (!normalized || working) return;
    void perform(async () => {
      await onUpdateTask(id, { title: normalized, memo: editMemo });
      setEditingId(null);
    });
  };

  const schedule = (id: string, date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || working) return;
    void perform(() => onUpdateTask(id, { date }));
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Backlog" height="full">
      <div className="space-y-4 px-1 pb-6">
        <p className="text-sm text-gray-400">
          Tasks without a date. They're private while in Backlog; scheduling an
          existing task restores its ordinary visibility.
        </p>
        <form onSubmit={(event) => { void submit(event); }} className="space-y-2">
          <label htmlFor="backlog-task-title" className="block text-sm text-gray-300">Add a task</label>
          <input id="backlog-task-title" value={title} maxLength={255}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What do you need to do?"
            className="w-full rounded-lg border border-[#333333] bg-surface px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60" />
          <div className="flex items-center gap-2">
            <label htmlFor="backlog-category" className="sr-only">Category</label>
            <select id="backlog-category" value={selectedCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={!categories.length || working}
              className="min-w-0 flex-1 rounded-lg border border-[#333333] bg-surface px-2 py-2 text-sm text-white">
              {categories.length === 0 && <option value="">No categories available</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button type="submit" disabled={!title.trim() || !selectedCategoryId || working}>Add to Backlog</Button>
          </div>
        </form>
        {!categories.length && <p role="status" className="text-sm text-gray-400">Create a category from Lists & Categories first.</p>}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-white">Unscheduled tasks ({unscheduled.length})</h3>
          <Button variant="ghost" type="button" onClick={() => setShowCompleted((v) => !v)}>
            {effectiveShowCompleted ? 'Hide completed' : `Show completed (${completedCount})`}
          </Button>
        </div>
        {shown.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">
            {unscheduled.length ? 'All your backlog tasks are completed.' : 'Nothing in Backlog yet.'}
          </p>
        )}
        <ul className="space-y-2">
          {shown.map((task) => {
            const category = categoryById.get(task.categoryId);
            return (
              <li key={task.id} id={'backlog-task-' + task.id}
                className="space-y-2 rounded-xl border border-[#333333] bg-surface p-3"
                style={task.id === focusTaskId ? { outline: '2px solid var(--accent-color, currentColor)', outlineOffset: '2px' } : undefined}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={task.completed}
                    disabled={working}
                    onChange={(event) => { void perform(() => onToggleTask(task.id, event.target.checked)); }}
                    aria-label={`Complete ${task.title}`}
                    className="mt-1 h-5 w-5 shrink-0 accent-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className={task.completed ? 'break-words text-gray-400 line-through' : 'break-words text-white'}>{task.title}</div>
                    <div className="text-xs text-gray-400" style={{ color: category?.color }}>{category?.name ?? 'Uncategorized'}</div>
                    {task.memo && editingId !== task.id && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-400">{task.memo}</p>}
                  </div>
                  <Button type="button" variant="ghost" disabled={working}
                    onClick={() => editingId === task.id ? setEditingId(null) : startEdit(task)}>
                    {editingId === task.id ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
                {editingId === task.id && (
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400" htmlFor={'backlog-title-' + task.id}>Title</label>
                    <input id={'backlog-title-' + task.id} value={editTitle} maxLength={255}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-[#333333] bg-background px-3 py-2 text-white" />
                    <label className="block text-xs text-gray-400" htmlFor={'backlog-memo-' + task.id}>Memo</label>
                    <textarea id={'backlog-memo-' + task.id} value={editMemo} maxLength={2000}
                      onChange={(e) => setEditMemo(e.target.value)}
                      className="min-h-20 w-full rounded-lg border border-[#333333] bg-background px-3 py-2 text-white" />
                    <Button type="button" disabled={working || !editTitle.trim()} onClick={() => saveEdit(task.id)}>Save</Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" disabled={working}
                    onClick={() => schedule(task.id, format(new Date(), 'yyyy-MM-dd'))}>Today</Button>
                  <Button type="button" variant="ghost" disabled={working}
                    onClick={() => schedule(task.id, format(addDays(new Date(), 1), 'yyyy-MM-dd'))}>Tomorrow</Button>
                  <label className="text-xs text-gray-400" htmlFor={'backlog-date-' + task.id}>Schedule date</label>
                  <input id={'backlog-date-' + task.id} type="date" disabled={working}
                    aria-label={`Schedule ${task.title}`}
                    onChange={(event) => schedule(task.id, event.target.value)}
                    className="min-w-0 rounded-lg border border-[#333333] bg-background px-2 py-1.5 text-sm text-white" />
                  <Button type="button" variant="danger" disabled={working}
                    onClick={() => { void perform(() => onUpdateTask(task.id, { isDeleted: true })); }}>Delete</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </BottomSheet>
  );
};
