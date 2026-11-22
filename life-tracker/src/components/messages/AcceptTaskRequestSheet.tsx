import React, { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { BottomSheet } from '../ui/BottomSheet';
import { MosaicSelect } from '../ui/MosaicSelect';
import { useCategories } from '../../hooks/useCategories';
import { canAddNewTaskToCategory } from '../../lib/categoryLifecycle';
import { transitionTaskRequest, taskRequestOperationId, type TaskRequestItem } from '../../lib/taskRequests';

interface Props {
  item: TaskRequestItem | null;
  onClose: () => void;
  onAccepted: (next: TaskRequestItem) => void;
}
export const AcceptTaskRequestSheet: React.FC<Props> = ({ item, onClose, onAccepted }) => {
  const { categories } = useCategories(Boolean(item));
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(item?.suggestedDate || format(new Date(), 'yyyy-MM-dd'));
  const [backlog, setBacklog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const command = useRef('');
  const chosenDate = backlog ? '' : date;
  const eligible = useMemo(() => categories.filter(cat => !cat.isDeleted &&
    canAddNewTaskToCategory(cat, chosenDate)), [categories, chosenDate]);
  const selectedCategory = eligible.find(category => category.id === categoryId);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || busy || !selectedCategory) return;
    if (!command.current) command.current = taskRequestOperationId();
    setBusy(true); setError('');
    try {
      const next = await transitionTaskRequest({
        operation: 'accept', requestId: item.id, operationId: command.current,
        expectedRevision: item.revision, categoryId,
        date: chosenDate, ownerLocalDate: format(new Date(), 'yyyy-MM-dd'),
      });
      onAccepted(next); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Task request could not be accepted'); }
    finally { setBusy(false); }
  };
  return <BottomSheet isOpen={Boolean(item)} onClose={onClose} title="Accept task" height="auto" backdropBlur>
    <form onSubmit={event => void submit(event)} className="space-y-4 px-4 pb-8 pt-2">
      <p className="break-words font-medium text-white">{item?.title}</p>
      <p className="text-xs text-gray-400">This creates a new private task in your account. Your friend cannot see how you categorize or complete it.</p>
      <label className="block text-sm text-gray-400">Date
        <input aria-label="Task date" type="date" value={date} disabled={busy || backlog}
          onChange={event => { setDate(event.target.value); setCategoryId(''); command.current = ''; }}
          className="mosaic-native-color-scheme mt-2 block w-full rounded-xl border border-[var(--mosaic-border)] bg-surfaceHighlight p-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60" />
      </label>
      <label className="flex items-center gap-2 text-sm text-white">
        <input type="checkbox" checked={backlog} disabled={busy}
          onChange={event => { setBacklog(event.target.checked); setCategoryId(''); command.current = ''; }}
          className="accent-[var(--mosaic-accent)]" />
        Save to Backlog (no date)
      </label>
      <div>
        <p className="text-sm text-gray-400">Your category</p>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <MosaicSelect label="Your category" value={categoryId} disabled={busy}
            options={eligible.map(category => ({ value: category.id, label: category.name, color: category.color }))}
            onChange={value => { setCategoryId(value); command.current = ''; }}
            placeholder="Select a category" className="min-w-0 flex-1" />
          {selectedCategory && <span aria-label={'Selected category color for ' + selectedCategory.name}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--mosaic-border)] bg-surfaceHighlight">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: selectedCategory.color }} />
          </span>}
        </div>
      </div>
      {!eligible.length && <p className="text-xs text-gray-400">No active category is available for this date. Create or restore one in Category Manager, then return to this request.</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy || !selectedCategory || (!backlog && !date)}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-emerald-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
        {busy ? 'Accepting…' : 'Add task'}
      </button>
    </form>
  </BottomSheet>;
};
