import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import type { CategoryDocument, TaskDocument } from '../../db/schema';
import { getLocalTodayKey, getTodayWidgetProgress, selectTodayWidgetTasks } from '../../lib/todayWidget';

interface WidgetsPageProps {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
}

/** Updates at the user's next local midnight and when the PWA returns to foreground. */
function useLocalToday() {
  const [dayKey, setDayKey] = useState(getLocalTodayKey);
  useEffect(() => {
    let timeoutId: number | undefined;
    const schedule = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
      timeoutId = window.setTimeout(() => {
        setDayKey(getLocalTodayKey());
        schedule();
      }, Math.max(100, nextMidnight.getTime() - now.getTime()));
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setDayKey(getLocalTodayKey());
        schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return dayKey;
}

interface TodayRowProps {
  task: TaskDocument;
  color: string;
  disabled: boolean;
  onToggle: (task: TaskDocument) => void;
}

const TodayRow = React.memo<TodayRowProps>(({ task, color, disabled, onToggle }) => (
  <li className="flex min-w-0 items-start gap-3 py-2">
    <button
      type="button"
      role="checkbox"
      aria-checked={task.completed}
      aria-label={task.title || 'Untitled task'}
      disabled={disabled}
      onClick={() => onToggle(task)}
      onPointerDown={event => event.stopPropagation()}
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
      style={{ borderColor: task.completed ? color : '#6B7280', backgroundColor: task.completed ? color : 'transparent' }}
    >
      {task.completed && <Check size={15} strokeWidth={3.5} color="white" aria-hidden="true" />}
    </button>
    <span className={'min-w-0 flex-1 break-words text-sm leading-6 ' + (task.completed ? 'text-gray-400 line-through' : 'text-white')}>
      {task.title}
    </span>
  </li>
));
TodayRow.displayName = 'TodayRow';

/** Lazy Home-neighbor panel: reuses the one owner Home subscription and existing completion domain command. */
export const WidgetsPage: React.FC<WidgetsPageProps> = ({ tasks, categories }) => {
  const { user } = useAuth();
  const ownerId = user?.$id ?? '';
  const dayKey = useLocalToday();
  const { toggleTaskCompletion } = useTasks(false);
  const rows = useMemo(() => selectTodayWidgetTasks(tasks, categories, ownerId, dayKey), [tasks, categories, ownerId, dayKey]);
  const progress = useMemo(() => getTodayWidgetProgress(rows), [rows]);
  const colorByCategory = useMemo(() => new Map(categories
    .filter(category => !category.isDeleted && category.userId === ownerId)
    .map(category => [category.id, category.color] as const)), [categories, ownerId]);

  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [failure, setFailure] = useState<{ ownerId: string; dayKey: string } | null>(null);
  const error = failure?.ownerId === ownerId && failure?.dayKey === dayKey;

  const onToggle = useCallback((task: TaskDocument) => {
    if (!ownerId || task.userId !== ownerId || task.isDeleted || task.date !== dayKey) return;
    const key = ownerId + ':' + task.id;
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    setFailure(null);
    void toggleTaskCompletion(task.id, !task.completed)
      .catch(() => setFailure({ ownerId, dayKey }))
      .finally(() => {
        pendingRef.current.delete(key);
        setPending(new Set(pendingRef.current));
      });
  }, [dayKey, ownerId, toggleTaskCompletion]);

  return (
    <div data-testid="widgets-page" className="flex h-full min-h-0 flex-col px-3 pb-4 pt-3">
      <section aria-label="Today" className="mosaic-material-control flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#333333] bg-surface px-4 py-4">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Today</h2>
          <span className="text-xs font-medium tabular-nums text-gray-400">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Today's task progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.percentage)}
          aria-valuetext={progress.completed + ' of ' + progress.total + ' tasks complete'}
          className="mt-3 h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surfaceHighlight"
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: progress.percentage + '%' }} />
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-red-400">Could not update task. Try again.</p>}
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No tasks today</p>
        ) : (
          <ul className="mt-3 min-h-0 overflow-y-auto overscroll-contain" aria-label="Today's tasks">
            {rows.map(task => (
              <TodayRow key={task.id} task={task} color={colorByCategory.get(task.categoryId) || '#6B7280'}
                disabled={pending.has(ownerId + ':' + task.id)} onToggle={onToggle} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
