import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Maximize2, Minimize2, Plus } from 'lucide-react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { getCategoryLabelColor } from '../../../constants/colors';
import { useDailyReview } from '../../../hooks/useDailyReview';
import { useTasks } from '../../../hooks/useTasks';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { reviewPinchIntent, reviewTouchDistance } from '../../../lib/dailyReviewPinch';
import { DailyReviewDiaryEditor } from './DailyReviewDiaryEditor';
import {
  executionForDay, planForDay, reviewTaskPlacement,
  type ReviewRecord,
} from '../../../lib/dailyReviewModel';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../../db/schema';

interface DailyReviewViewProps {
  date: Date;
  tasks: readonly TaskDocument[];
  categories?: readonly CategoryDocument[];
  diaryEntries?: readonly DiaryDocument[];
  userId?: string;
  onSaveDiary?: (entryId: string, date: string, content: string, visibility: DiaryDocument['visibility'],
    emoji: string, photos?: string) => Promise<void>;
  onOpenDiary: (date: Date, entryId?: string) => void;
  onCreateDiary?: (date: Date) => void;
  onOpenTask?: (task: TaskDocument) => void;
  onDateChange?: (date: Date) => void;
}

type TaskTransfer = { taskId: string; title: string; completed: boolean; scheduledDate: string; reviewDate: string };

const stages = ['Plan', 'Execution', 'Reflection'] as const;

const CategoryMark: React.FC<{ name?: string; color?: string }> = ({ name, color }) =>
  name ? <span className="mosaic-category-pill mosaic-material-control mt-1 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-surfaceHighlight px-2 py-0.5 text-[11px] font-medium">
    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color || 'var(--mosaic-text-muted)' }} />
    <span className="min-w-0 break-words"
      style={color ? { color: getCategoryLabelColor(color) } : undefined}>{name}</span>
  </span> : null;

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({
  date, tasks, categories = [], diaryEntries = [], onSaveDiary, onOpenDiary, onCreateDiary, onOpenTask, onDateChange, userId = '',
}) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const { records, isLoading, editPlan, recordOutcome } = useDailyReview();
  // Mutations use the same owner task hook as Calendar and Todo. The parent
  // supplies the already subscribed owner task collection for immediate updates.
  const { addTask, updateTask, toggleTaskCompletion } = useTasks(false);
  const [overview, setOverview] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [draftTask, setDraftTask] = useState('');
  const [draftExecution, setDraftExecution] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [editingPlanId, setEditingPlanId] = useState('');
  const [editingPlanTitle, setEditingPlanTitle] = useState('');
  const [selectedDiaryEntryId, setSelectedDiaryEntryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [transfer, setTransfer] = useState<TaskTransfer | null>(null);
  const [recentMove, setRecentMove] = useState<TaskTransfer | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Array<HTMLElement | null>>([]);

  const plans = useMemo(() => planForDay(records, dateKey), [records, dateKey]);
  const executions = useMemo(() => executionForDay(records, dateKey), [records, dateKey]);
  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const categoryOfTask = (task: TaskDocument) => categoriesById.get(task.categoryId);
  const categoryOfRecord = (record: ReviewRecord) => {
    if (record.categoryName !== undefined)
      return record.categoryName ? { name: record.categoryName, color: record.categoryColor } : undefined;
    const task = tasksById.get(record.taskId);
    return task ? categoryOfTask(task) : undefined;
  };
  const ownedTasks = tasks.filter(task => !task.isDeleted && !!userId && task.userId === userId);
  // No import/setup: the existing scheduled task is already the day's plan.
  const pendingTasks = ownedTasks.filter(task => reviewTaskPlacement(task, dateKey) === 'plan');
  // A task scheduled on this date must always have a reversible destination.
  // Completed work scheduled for another day is explicitly separated.
  const completedTasks = ownedTasks.filter(task => reviewTaskPlacement(task, dateKey) === 'execution');
  const completedElsewhere = ownedTasks.filter(task => reviewTaskPlacement(task, dateKey) === 'completed-elsewhere');
  // Keep historical independent plans, and snapshots for tasks removed or moved
  // since an older plan was recorded. Do not duplicate currently dated tasks.
  const legacyPlans = plans.filter(plan => !plan.taskId ||
    !tasksById.has(plan.taskId) || tasksById.get(plan.taskId)?.date !== dateKey);
  const legacyExecutions = executions.filter(record => record.result === 'completed' &&
    (!record.taskId || ![...completedTasks, ...completedElsewhere].some(task => task.id === record.taskId)));
  const availableTasks = ownedTasks.filter(task => !task.completed && task.date !== dateKey);
  const validCategories = categories.filter(category => !category.isDeleted &&
    !!userId && category.userId === userId && canAddNewTaskToCategory(category, dateKey));
  const categoryIdForNewTask = validCategories.some(c => c.id === selectedCategoryId)
    ? selectedCategoryId : validCategories[0]?.id ?? '';
  const completedCount = completedTasks.length + completedElsewhere.length + legacyExecutions.length;

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save review.'); }
    finally { setBusy(false); }
  };
  const focusStage = (index: number) => {
    const strip = scrollerRef.current;
    if (strip && !overview && index !== activeStage) {
      // Native horizontal scrolling supplies finger-following motion and snap.
      strip.scrollTo?.({ left: index * strip.clientWidth,
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    setActiveStage(index);
    setOverview(false);
  };

  // Mode changes alter each panel's width. Align after the new layout is committed,
  // not during a touch or trackpad scroll (which must remain browser-owned).
  useLayoutEffect(() => {
    const strip = scrollerRef.current;
    if (strip) strip.scrollLeft = overview ? 0 : activeStage * strip.clientWidth;
  }, [overview]);

  // Only two-finger pinches change the layout. Neither a horizontal scroll
  // animation nor a touchmove preventDefault is used for one-finger pan-y.
  useEffect(() => {
    const strip = scrollerRef.current;
    if (!strip) return;
    let pinch: { start: number; current: number; centerX: number } | null = null;
    const start = (event: TouchEvent) => {
      pinch = null;
      if (event.touches.length !== 2 ||
        (event.target as Element).closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const distance = reviewTouchDistance(event.touches);
      if (distance >= 40) pinch = {
        start: distance, current: distance,
        centerX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
      };
    };
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      const distance = reviewTouchDistance(event.touches);
      if (Math.abs(distance - pinch.start) < 8) return;
      if (event.cancelable) event.preventDefault();
      pinch.current = distance;
      pinch.centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    };
    const finish = (event: TouchEvent) => {
      if (event.touches.length >= 2 || !pinch) return;
      const gesture = pinch;
      pinch = null;
      const intent = reviewPinchIntent(gesture.start, gesture.current, overview);
      if (intent === 'overview') setOverview(true);
      if (intent === 'focus') {
        const nearest = stageRefs.current.map((section, index) => {
          if (!section) return { index, distance: Infinity };
          const rect = section.getBoundingClientRect();
          return { index, distance: Math.abs((rect.left + rect.right) / 2 - gesture.centerX) };
        }).sort((a, b) => a.distance - b.distance)[0];
        focusStage(nearest?.index ?? activeStage);
      }
    };
    const cancel = () => { pinch = null; };
    const safariPinch = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };
    strip.addEventListener('touchstart', start, { passive: true });
    strip.addEventListener('touchmove', move, { passive: false });
    strip.addEventListener('touchend', finish);
    strip.addEventListener('touchcancel', cancel);
    strip.addEventListener('gesturestart', safariPinch, { passive: false });
    return () => {
      strip.removeEventListener('touchstart', start);
      strip.removeEventListener('touchmove', move);
      strip.removeEventListener('touchend', finish);
      strip.removeEventListener('touchcancel', cancel);
      strip.removeEventListener('gesturestart', safariPinch);
    };
  }, [overview, activeStage]);

  // A local completion mutation is the only source of this transition cue.
  // React receives it before the RxDB row moves, so the destination animates on mount.
  const moveTask = (task: TaskDocument, completed: boolean) => {
    if (busy) return;
    const next: TaskTransfer = {
      taskId: task.id, title: task.title, completed, scheduledDate: task.date, reviewDate: dateKey,
    };
    setTransfer(next);
    void run(async () => {
      await toggleTaskCompletion(task.id, completed);
      setRecentMove(next);
      window.setTimeout(() => setTransfer(current => current === next ? null : current), 1200);
    });
  };

  const undoMove = () => {
    if (!recentMove || busy) return;
    const original = recentMove;
    const current = ownedTasks.find(task => task.id === original.taskId);
    if (!current) {
      setRecentMove(null);
      setError('Task is no longer available. Refresh the review before retrying.');
      return;
    }
    // The canonical mutation reads RxDB itself: parent props may still be
    // one subscription frame behind the completed write on a rapid Undo.
    const reverse = { ...original, completed: !original.completed };
    setTransfer(reverse);
    void run(async () => {
      await toggleTaskCompletion(original.taskId, reverse.completed);
      setRecentMove(null);
      window.setTimeout(() => setTransfer(value => value === reverse ? null : value), 1200);
    });
  };

  useEffect(() => {
    if (!recentMove || (!recentMove.completed && recentMove.scheduledDate !== dateKey)) return;
    const timer = window.setTimeout(() => setRecentMove(current =>
      current === recentMove ? null : current), 8000);
    return () => window.clearTimeout(timer);
  }, [recentMove, dateKey]);

  const taskRow = (task: TaskDocument, compact: boolean) => {
    const category = categoryOfTask(task);
    const checkboxColor = category?.color || 'var(--mosaic-accent)';
    const arrival = transfer?.taskId === task.id && transfer.reviewDate === dateKey &&
      transfer.completed === task.completed
      ? (task.completed ? ' mosaic-review-arrive-from-plan' : ' mosaic-review-arrive-from-execution')
      : '';
    return <div key={task.id} className={'mosaic-material-control min-w-0 rounded-lg bg-surfaceHighlight ' +
      (compact ? 'p-1.5' : 'p-2') + arrival} data-review-task-id={task.id}>
      <div className="flex min-w-0 items-start gap-3">
        <button type="button" role="checkbox" aria-checked={task.completed} disabled={busy}
          aria-label={task.completed ? 'Mark incomplete: ' + task.title : 'Mark complete: ' + task.title}
          onClick={() => moveTask(task, !task.completed)}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent)] disabled:opacity-40"
          style={{ borderColor: task.completed ? checkboxColor : '#4B5563',
            backgroundColor: task.completed ? checkboxColor : 'transparent' }}>
          {task.completed && <Check size={15} strokeWidth={4} aria-hidden="true"
            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
            style={{ color: '#fff' }} />}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenTask?.(task)}
            aria-label={'Actions for ' + task.title}
            className="w-full min-w-0 break-words text-left text-xs text-white focus-visible:outline focus-visible:underline">
            {task.title}
          </button>
          <CategoryMark name={category?.name} color={category?.color} />
        </div>
      </div>
    </div>;
  };

  const legacyPlanRow = (plan: ReviewRecord, compact: boolean) => {
    const category = categoryOfRecord(plan);
    return <div key={plan.id} className="mosaic-material-control min-w-0 rounded-lg bg-surfaceHighlight p-2">
      {editingPlanId === plan.id && !compact ? <form onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          await editPlan(plan.id, editingPlanTitle);
          setEditingPlanId('');
        });
      }} className="min-w-0 space-y-1">
        <input aria-label="Edit plan item" maxLength={255}
          value={editingPlanTitle} onChange={event => setEditingPlanTitle(event.target.value)}
          className="min-w-0 w-full rounded border border-[#444444] bg-surface p-1 text-sm" />
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="submit" disabled={busy || !editingPlanTitle.trim()}>Save</button>
          <button type="button" onClick={() => setEditingPlanId('')}>Cancel</button>
        </div>
      </form> : <button type="button" className="w-full break-words text-left text-xs text-white"
        aria-label={'Edit plan: ' + plan.title}
        onClick={() => {
          setEditingPlanId(plan.id);
          setEditingPlanTitle(plan.title);
          focusStage(0);
        }}>{plan.title}</button>}
      <CategoryMark {...(category ?? {})} />
    </div>;
  };

  const planItems = (compact: boolean) => <div className="mt-2 min-w-0 space-y-2">
    {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
    {!isLoading && pendingTasks.length === 0 && legacyPlans.length === 0 &&
      <p className="text-xs text-gray-400">No pending tasks</p>}
    {pendingTasks.map(task => taskRow(task, compact))}
    {legacyPlans.map(plan => legacyPlanRow(plan, compact))}
  </div>;

  const executionItems = (compact: boolean) => <div className="mt-2 min-w-0 space-y-2">
    {completedCount === 0 && <p className="text-xs text-gray-400">No completed tasks</p>}
    {completedTasks.map(task => taskRow(task, compact))}
    {completedElsewhere.length > 0 && <div className="mt-3 space-y-2">
      <p className="text-xs text-gray-400">Completed on this day · scheduled elsewhere</p>
      {completedElsewhere.map(task => <div key={task.id} className="space-y-0.5">
        {taskRow(task, compact)}
        <p className="px-2 text-[11px] text-gray-400">Scheduled for {task.date}</p>
      </div>)}
    </div>}
    {legacyExecutions.map(item => <div key={item.id} className="mosaic-material-control rounded-lg bg-surfaceHighlight p-2">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: categoryOfRecord(item)?.color || 'var(--mosaic-accent)' }}>
          <Check size={15} strokeWidth={4} style={{ color: '#fff' }} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="break-words text-xs text-white">{item.title}</span>
          <CategoryMark {...(categoryOfRecord(item) ?? {})} />
        </div>
      </div>
    </div>)}
  </div>;

  const planBody = <div className="min-w-0">
    {planItems(false)}
    <div className="mt-4 space-y-2">
      <h4 className="text-xs font-medium text-gray-300">Add scheduled task</h4>
      <form className="flex min-w-0 flex-col gap-2" onSubmit={event => {
        event.preventDefault();
        if (!categoryIdForNewTask || !draftTask.trim()) return;
        void run(async () => {
          await addTask({ title: draftTask.trim(), date: dateKey, completed: false,
            categoryId: categoryIdForNewTask, visibility: '' });
          setDraftTask('');
        });
      }}>
        <input aria-label="New plan task" value={draftTask}
          onChange={event => setDraftTask(event.target.value)}
          placeholder="New task" maxLength={255}
          className="min-w-0 w-full rounded-lg border border-[#444444] bg-surfaceHighlight p-2 text-xs text-white" />
        {validCategories.length > 0 && <MosaicSelect label="Task category" variant="category" value={categoryIdForNewTask}
          onChange={setSelectedCategoryId} options={validCategories.map(category => ({
            value: category.id, label: category.name, color: category.color,
          }))} />}
        <button type="submit" disabled={busy || !draftTask.trim() || !categoryIdForNewTask}
          className="mosaic-material-control rounded-lg bg-surfaceHighlight p-2 text-xs text-white disabled:opacity-40">
          <Plus size={14} aria-hidden="true" className="mr-1 inline" />Add task
        </button>
        {validCategories.length === 0 && <p className="text-xs text-gray-400">Create a category in Calendar first.</p>}
      </form>
      {availableTasks.length > 0 && <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-300">Reschedule an existing task</h4>
        <MosaicSelect label="Choose task" value={selectedTaskId} onChange={setSelectedTaskId}
          options={[{ value: '', label: 'Choose task' },
            ...availableTasks.slice(0, 150).map(task => {
              const category = categoryOfTask(task);
              return {
                value: task.id, label: (category?.name ? category.name + ' · ' : '') + task.title,
                color: category?.color,
              };
            })]} />
        <button type="button" disabled={busy || !selectedTaskId}
          onClick={() => void run(async () => {
            const task = availableTasks.find(item => item.id === selectedTaskId);
            if (task) await updateTask(task.id, { date: dateKey });
            setSelectedTaskId('');
          })} className="mosaic-material-control w-full rounded-lg bg-surfaceHighlight p-2 text-xs disabled:opacity-40">
          Move to this day
        </button>
      </div>}
      {legacyPlans.length === 0 && <p className="text-xs text-gray-400">
        Tasks scheduled here appear automatically; edits also update Calendar and Todo.
      </p>}
    </div>
  </div>;

  const executionBody = <div className="min-w-0">
    <p className="mt-2 text-xs text-gray-400">{completedCount} completed</p>
    {executionItems(false)}
    <h4 className="mt-4 text-xs font-semibold text-white">Other accomplishments</h4>
    <form className="mt-2 flex min-w-0 flex-col gap-2" onSubmit={event => {
      event.preventDefault();
      void run(async () => {
        await recordOutcome(dateKey, 'completed', draftExecution);
        setDraftExecution('');
      });
    }}>
      <input aria-label="Unplanned accomplishment" value={draftExecution}
        onChange={event => setDraftExecution(event.target.value)}
        placeholder="Add accomplishment" maxLength={255}
        className="min-w-0 w-full rounded-lg border border-[#444444] bg-surfaceHighlight p-2 text-xs" />
      <button type="submit" disabled={busy || !draftExecution.trim()}
        className="mosaic-material-control rounded-lg bg-surfaceHighlight p-2 text-xs disabled:opacity-40">Add accomplishment</button>
    </form>
  </div>;

  // Diary entries are distinct records on current dev. Never infer a single
  // bulk entry or let an inline edit target whichever entry was updated last.
  const reviewDiaryEntries = diaryEntries.filter(entry =>
    !entry.isDeleted && !!userId && entry.userId === userId && entry.date === dateKey
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const selectedDiaryEntry = reviewDiaryEntries.find(entry => entry.id === selectedDiaryEntryId) ??
    reviewDiaryEntries[0];

  const reflectionBody = <div className="min-w-0">
    {reviewDiaryEntries.length > 1 && <div className="mt-3">
      <MosaicSelect label="Diary entry" value={selectedDiaryEntry?.id ?? ''}
        onChange={setSelectedDiaryEntryId}
        options={reviewDiaryEntries.map((entry, index) => ({
          value: entry.id,
          label: 'Entry ' + (index + 1) + (entry.content?.trim()
            ? ' · ' + entry.content?.trim().slice(0, 36) : ''),
        }))} />
    </div>}
    {selectedDiaryEntry && onSaveDiary && userId
      ? <DailyReviewDiaryEditor
          key={userId + ':' + dateKey + ':' + selectedDiaryEntry.id}
          date={dateKey} userId={userId} entry={selectedDiaryEntry}
          onSave={(targetDate, content, visibility, emoji, photos) =>
            onSaveDiary(selectedDiaryEntry.id, targetDate, content, visibility, emoji, photos)}
          onOpenFull={() => onOpenDiary(date, selectedDiaryEntry.id)} />
      : <button type="button" onClick={() => (onCreateDiary ?? onOpenDiary)(date)}
          className="mosaic-material-control mt-3 rounded-lg bg-surfaceHighlight p-2 text-xs">
          {reviewDiaryEntries.length ? 'Open Diary entry' : 'Add Diary entry'}
        </button>}
    {reviewDiaryEntries.length > 0 && onCreateDiary && <button type="button"
      onClick={() => onCreateDiary(date)}
      className="mosaic-material-control mt-2 rounded-lg bg-surfaceHighlight px-3 py-2 text-xs">
      New Diary entry
    </button>}
  </div>;

  const overviewBodies = [
    planItems(true),
    executionItems(true),
    <div className="mt-2 min-w-0 space-y-2 text-xs text-gray-300">
      {reviewDiaryEntries.length === 0 ? <p>No Diary entries</p> :
        reviewDiaryEntries.map((entry, index) => <p key={entry.id} className="break-words whitespace-pre-wrap">
          {reviewDiaryEntries.length > 1 ? 'Entry ' + (index + 1) + ': ' : ''}
          {entry.content?.trim() || '(No text)'}
        </p>)}
      {completedTasks.slice(0, 5).map(task => <p key={task.id} className="break-words text-gray-400">
        {task.title}
      </p>)}
    </div>,
  ];

  // Overview: three equal columns. Focus: three full-width scroll-snap panels,
  // preserving native finger/trackpad horizontal motion and individual vertical scroll.

  return <div className="swiper-no-swiping flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-3 text-white"
    data-testid="daily-review-workspace">
    <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
      <h2 className="mosaic-general-text text-sm font-semibold">Daily Review</h2>
      <button type="button" onClick={() => setOverview(value => !value)}
        aria-label={overview ? 'Focus daily review' : 'Show all three review stages'}
        aria-pressed={overview}
        className="mosaic-material-control flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-xs focus-visible:outline">
        {overview ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
        {overview ? 'Focus' : 'Overview'}
      </button>
    </div>
    {error && <p role="alert" className="mb-2 shrink-0 rounded-lg border border-red-500 p-2 text-xs">{error}</p>}
    {recentMove?.reviewDate === dateKey && <div role="status" aria-live="polite"
      className="mosaic-material-control mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surfaceHighlight px-3 py-2 text-xs">
      <span className="min-w-0 flex-1">
        {recentMove.completed ? 'Moved to Execution' : recentMove.scheduledDate === dateKey
          ? 'Returned to Plan' : 'Uncompleted · scheduled for ' + recentMove.scheduledDate}
      </span>
      <div className="flex items-center gap-3">
        {!recentMove.completed && recentMove.scheduledDate !== dateKey && onDateChange &&
          <button type="button" className="underline focus-visible:outline"
            onClick={() => {
              onDateChange(parseISO(recentMove.scheduledDate));
              focusStage(0);
              setRecentMove(null);
            }}>View Plan day</button>}
        <button type="button" disabled={busy} onClick={undoMove}
          aria-label={'Undo completion change for ' + recentMove.title}
          className="font-semibold underline focus-visible:outline disabled:opacity-40">Undo</button>
        <button type="button" aria-label="Dismiss task movement notice"
          onClick={() => setRecentMove(null)} className="text-gray-400 focus-visible:outline">Dismiss</button>
      </div>
    </div>}
    <nav aria-label="Daily Review stages" className="mb-2 grid shrink-0 grid-cols-3 gap-2">
      {stages.map((stage, index) => <button type="button" key={stage}
        aria-current={!overview && activeStage === index ? 'step' : undefined}
        onClick={() => focusStage(index)}
        className={'mosaic-material-control rounded-lg px-1 py-2 text-xs focus-visible:outline ' +
          (!overview && activeStage === index ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}>
        {stage}
      </button>)}
    </nav>
    <div ref={scrollerRef} data-testid="daily-review-stage-strip"
      data-overview={overview || undefined}
      onScroll={event => {
        if (overview || !event.currentTarget.clientWidth) return;
        const next = Math.max(0, Math.min(2,
          Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)));
        setActiveStage(current => current === next ? current : next);
      }}
      className={'flex min-h-0 min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 ' +
        (overview ? 'gap-2' : 'gap-0')}
      style={{ scrollbarWidth: 'none', touchAction: 'pan-x pan-y',
        scrollSnapType: overview ? 'none' : 'x mandatory',
        WebkitOverflowScrolling: 'touch' }}>
      {stages.map((stage, index) => <section key={stage}
        ref={node => { stageRefs.current[index] = node; }}
        aria-hidden={!overview && index !== activeStage}
        inert={!overview && index !== activeStage}
        aria-label={stage} data-review-stage={stage.toLowerCase()}
        onClick={event => {
          if (overview && !(event.target as Element).closest('button,input,textarea,select,a,[role="combobox"]'))
            focusStage(index);
        }}
        className="mosaic-material-panel min-w-0 shrink-0 overflow-y-auto overscroll-y-contain rounded-xl border border-[#333333] bg-surface p-2 transition-[background-color] duration-150"
        style={{ overflowWrap: 'anywhere', flexBasis: overview ? 'calc((100% - 1rem) / 3)' : '100%',
          scrollSnapAlign: overview ? undefined : 'start', touchAction: 'pan-x pan-y' }}>
        <h3 className="mosaic-general-text min-w-0 text-xs font-semibold text-white">
          <button type="button" onClick={() => focusStage(index)}
            aria-label={'Focus ' + stage} className="w-full break-words text-left focus-visible:outline">
            {stage}
          </button>
        </h3>
        {overview ? overviewBodies[index] : [planBody, executionBody, reflectionBody][index]}
      </section>)}
    </div>
  </div>;
};
