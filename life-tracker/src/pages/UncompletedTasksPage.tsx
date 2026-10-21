import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ListTodo } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import { hasExpectedRouteParent, makeRouteParentState, resolveRouteParent } from '../lib/primarySwipeNavigation';
import { groupUncompletedTasks, isScheduledDateKey } from '../lib/uncompletedTasks';
import type { TaskDocument } from '../db/schema';

export const UncompletedTasksPage: React.FC = () => {
  const { user } = useAuth();
  const { tasks, isLoading: tasksLoading, toggleTaskCompletion } = useTasks();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();
  const parent = resolveRouteParent('/backlog', location.state) ?? '/home';
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const ownerId = user?.$id;

  // Keep date groups correct when an open PWA crosses midnight or returns to foreground.
  useEffect(() => {
    const refreshToday = () => setToday(format(new Date(), 'yyyy-MM-dd'));
    const interval = window.setInterval(refreshToday, 60_000);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, []);

  const sections = useMemo(
    () => groupUncompletedTasks(tasks, ownerId, today),
    [tasks, ownerId, today],
  );
  const total = sections.reduce((count, section) => count + section.tasks.length, 0);
  const categoryById = useMemo(() => new Map(
    categories.filter(category => category.userId === ownerId && !category.isDeleted)
      .map(category => [category.id, category]),
  ), [categories, ownerId]);

  const handleBack = () => {
    if (hasExpectedRouteParent(location.key, location.state, parent)) navigate(-1);
    else navigate(parent, { replace: true });
  };

  const openTask = (task: TaskDocument) => {
    if (task.date === '') {
      navigate('/backlog', { state: { ...makeRouteParentState('/backlog?view=uncompleted'), focusTaskId: task.id } });
    } else if (isScheduledDateKey(task.date)) {
      navigate('/home', { state: { focusTaskId: task.id, focusTaskDate: task.date } });
    }
  };

  const completeTask = async (task: TaskDocument) => {
    if (pending.has(task.id)) return;
    setPending(current => new Set(current).add(task.id));
    setError(null);
    try {
      await toggleTaskCompletion(task.id, true);
    } catch {
      setError('Could not complete task. Try again.');
    } finally {
      setPending(current => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button type="button" onClick={handleBack} onPointerDown={event => event.stopPropagation()}
          aria-label="Back"
          className="-ml-2 rounded-lg p-2 text-gray-400 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="mosaic-general-text min-w-0 flex-1 text-lg font-bold text-white">Uncompleted Tasks</h1>
        {!tasksLoading && <span className="rounded-full bg-surfaceHighlight px-2.5 py-1 text-xs text-gray-300" aria-label={`${total} uncompleted tasks`}>{total}</span>}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4" aria-label="Uncompleted tasks">
        {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
        {(tasksLoading || categoriesLoading) ? (
          <p role="status" className="py-10 text-center text-sm text-gray-400">Loading tasks…</p>
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
            <ListTodo size={28} aria-hidden="true" />
            <p className="mosaic-general-text text-sm">{ownerId ? 'All tasks completed.' : 'No tasks available.'}</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-8">
            {sections.map(section => (
              <section key={section.id} aria-labelledby={`uncompleted-${section.id}`}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-2.5">
                  <h2 id={`uncompleted-${section.id}`} className="mosaic-general-text text-sm font-semibold text-white">{section.title}</h2>
                  <span className="text-xs tabular-nums text-gray-500">{section.tasks.length}</span>
                </div>
                <div className="space-y-0.5">
                  {section.tasks.map((task) => {
                    const category = categoryById.get(task.categoryId);
                    const scheduled = isScheduledDateKey(task.date);
                    return (
                      <div key={task.id} className="flex min-w-0 items-start gap-3 rounded-xl px-2.5 py-3 transition-colors duration-150 hover:bg-surfaceHighlight focus-within:bg-surfaceHighlight">
                        <button type="button" role="checkbox" aria-checked={false}
                          aria-label={`Complete ${task.title}`}
                          disabled={pending.has(task.id)}
                          onClick={() => void completeTask(task)}
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-400 text-gray-400 transition-colors hover:border-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
                        </button>
                        <button type="button" onClick={() => openTask(task)}
                          disabled={task.date !== '' && !scheduled}
                          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default">
                          <span className="block break-words text-[15px] leading-5 text-white">{task.title}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-400">
                            {category && <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                              {category.name}
                            </span>}
                            <span>{task.date === '' ? 'No date' : scheduled ? format(parseISO(task.date), 'MMM d, yyyy') : 'Invalid date'}</span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default UncompletedTasksPage;
