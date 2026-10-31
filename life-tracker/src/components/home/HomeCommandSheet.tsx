import React, { useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import type { CategoryDocument } from '../../db/schema';
import { parseTaskCommand, isValidCommandDate } from '../../lib/taskCommands';
import { ADD_TASKS_TO_TOP_SETTING_KEY } from '../../lib/preferences';
import { useSettings } from '../../hooks/useSettings';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string | null;
  categories: CategoryDocument[];
  isLoading: boolean;
  onCreate: (task: { title: string; categoryId: string; date: string },
    position: 'top' | 'bottom') => Promise<void>;
};
type Review = { title: string; categoryId: string; date: string; unscheduled: boolean };
const fieldClass = 'w-full rounded-xl border border-[#3A3A3A] bg-[#202020] px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

export const HomeCommandSheet: React.FC<Props> = ({
  isOpen, onClose, ownerId, categories, isLoading, onCreate,
}) => {
  const [input, setInput] = useState('');
  const [reviewState, setReviewState] = useState<(Review & { ownerId: string | null }) | null>(null);
  // Reject stale owner-specific draft data without an effect-driven state write.
  const review = reviewState?.ownerId === ownerId ? reviewState : null;
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const pendingRef = useRef(false);
  const { getSetting } = useSettings();
  const ownedCategories = useMemo(() =>
    categories.filter(c => !c.isDeleted && ownerId && c.userId === ownerId),
    [categories, ownerId]
  );

  const handleClose = () => {
    if (pendingRef.current) return;
    onClose();
  };
  const reviewCommand = () => {
    if (isLoading || !ownerId) {
      setMessage('Your categories are still loading.');
      return;
    }
    const parsed = parseTaskCommand(input, ownedCategories.map(c => c.name));
    if (parsed.status === 'unsupported') {
      setReviewState(null);
      setMessage('This command is not supported yet. Preview supports creating one task at a time.');
      return;
    }
    const matched = parsed.status === 'create_task'
      ? ownedCategories.filter(c => c.name.toLocaleLowerCase() === parsed.category?.toLocaleLowerCase())
      : [];
    const categoryId = matched.length === 1 ? matched[0].id : '';
    const date = parsed.date ?? '';
    setReviewState({
      ownerId,
      title: parsed.title ?? '',
      categoryId,
      date: date || '',
      unscheduled: parsed.date === '',
    });
    setMessage(parsed.status === 'create_task'
      ? 'Check every field before creating the task.'
      : 'Could not safely interpret every field. Fill in the missing details manually.');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!review || pendingRef.current || isLoading || !ownerId) return;
    const title = review.title.trim();
    const category = ownedCategories.find(c => c.id === review.categoryId);
    const date = review.unscheduled ? '' : review.date;
    if (!title || title.length > 255 || !category ||
      (!review.unscheduled && !isValidCommandDate(date))) {
      setMessage('Enter a title, an existing category, and a valid date or choose Backlogs.');
      return;
    }
    pendingRef.current = true;
    setWorking(true);
    setMessage('');
    try {
      await onCreate({ title, categoryId: category.id, date },
        getSetting(ADD_TASKS_TO_TOP_SETTING_KEY, false) === true ? 'top' : 'bottom');
      setInput('');
      setReviewState(null);
      handleCloseAfterCreation();
    } catch {
      setMessage('Could not create task. Your data was not confirmed saved; check your tasks before retrying.');
    } finally {
      pendingRef.current = false;
      setWorking(false);
    }
  };
  const handleCloseAfterCreation = () => onClose();
  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Task command"
      ariaLabel="Create task from a command" preventDismiss={working}>
      <div className="space-y-4 p-4 pb-10 text-white" data-testid="home-command-sheet">
        <p className="text-sm text-gray-400">
          Type a task command. This Preview creates one task only; no bulk operations or voice recording.
        </p>
        <div>
          <label htmlFor="command-input" className="mb-2 block text-sm font-medium">Command</label>
          <textarea id="command-input" value={input} rows={3} maxLength={1024}
            placeholder="Add go to school to Errands for tomorrow"
            className={fieldClass}
            onChange={e => { setInput(e.target.value); setReviewState(null); setMessage(''); }} />
        </div>
        {!review ? (
          <button type="button" disabled={!input.trim() || working || isLoading || !ownerId}
            onClick={reviewCommand}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
            Review command
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl bg-[#1B1B1B] p-3 text-sm text-gray-300">
              Review before saving. Nothing is created until you confirm.
            </div>
            <div>
              <label htmlFor="command-title" className="mb-2 block text-sm font-medium">Task title</label>
              <input id="command-title" className={fieldClass} maxLength={255} value={review.title}
                onChange={e => setReviewState({ ...review, title: e.target.value })} />
            </div>
            <div>
              <label htmlFor="command-category" className="mb-2 block text-sm font-medium">Category</label>
              <select id="command-category" className={fieldClass} value={review.categoryId}
                onChange={e => setReviewState({ ...review, categoryId: e.target.value })}>
                <option value="">Choose a category</option>
                {ownedCategories.map(category =>
                  <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={review.unscheduled}
                onChange={e => setReviewState({ ...review, unscheduled: e.target.checked })} />
              Put in Backlogs (unscheduled)
            </label>
            {!review.unscheduled && (
              <div>
                <label htmlFor="command-date" className="mb-2 block text-sm font-medium">Task date</label>
                <input id="command-date" type="date" className={fieldClass} value={review.date}
                  onChange={e => setReviewState({ ...review, date: e.target.value })} />
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" disabled={working}
                onClick={() => { setReviewState(null); setMessage(''); }}
                className="flex-1 rounded-xl border border-[#555] px-4 py-3 text-sm">Edit command</button>
              <button type="submit" disabled={working || isLoading || !ownerId}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold disabled:opacity-40">
                {working ? 'Creating…' : 'Create task'}
              </button>
            </div>
          </form>
        )}
        {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
      </div>
    </BottomSheet>
  );
};
