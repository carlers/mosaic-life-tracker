import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Check, Maximize2, Minimize2, Plus } from 'lucide-react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { useDailyReview } from '../../../hooks/useDailyReview';
import { useTasks } from '../../../hooks/useTasks';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { reviewPinchIntent, reviewTouchDistance } from '../../../lib/dailyReviewPinch';
import { DailyReviewDiaryEditor } from './DailyReviewDiaryEditor';
import {
  executionForDay, planForDay, reviewDay, taskCompletionOnDay,
  type ReviewRecord,
} from '../../../lib/dailyReviewModel';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../../db/schema';

interface DailyReviewViewProps {
  date: Date;
  tasks: readonly TaskDocument[];
  categories?: readonly CategoryDocument[];
  diaryEntry?: DiaryDocument;
  userId?: string;
  onSaveDiary?: (date: string, content: string, visibility: DiaryDocument['visibility'],
    emoji: string, photos?: string) => Promise<void>;
  onOpenDiary: (date: Date) => void;
  onOpenTask?: (task: TaskDocument) => void;
}

const stages = ['Plan', 'Execution', 'Reflection'] as const;

const CategoryMark: React.FC<{ name?: string; color?: string }> = ({ name, color }) =>
  name ? <span className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-gray-400">
    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color || 'var(--mosaic-text-muted, #9CA3AF)' }} />
    <span className="break-words">{name}</span>
  </span> : null;

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({
  date, tasks, categories = [], diaryEntry, onSaveDiary, onOpenDiary, onOpenTask, userId = '',
}) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const { records, isLoading, editPlan, recordOutcome, finishReview } = useDailyReview();
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Array<HTMLElement | null>>([]);

  const plans = useMemo(() => planForDay(records, dateKey), [records, dateKey]);
  const executions = useMemo(() => executionForDay(records, dateKey), [records, dateKey]);
  const day = useMemo(() => reviewDay(records, dateKey), [records, dateKey]);
  const reviewed = Boolean(day?.reviewedAt);
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
  const pendingTasks = ownedTasks.filter(task => task.date === dateKey && !task.completed);
  // Completion is canonical. An action in Review changes Calendar/Todo too.
  const completedTasks = ownedTasks.filter(task => taskCompletionOnDay(task, dateKey));
  // Keep historical independent plans, and snapshots for tasks removed or moved
  // since an older plan was recorded. Do not duplicate currently dated tasks.
  const legacyPlans = plans.filter(plan => !plan.taskId ||
    !tasksById.has(plan.taskId) || tasksById.get(plan.taskId)?.date !== dateKey);
  const legacyExecutions = executions.filter(record => record.result === 'completed' &&
    (!record.taskId || !completedTasks.some(task => task.id === record.taskId)));
  const availableTasks = ownedTasks.filter(task => !task.completed && task.date !== dateKey);
  const validCategories = categories.filter(category => !category.isDeleted &&
    !!userId && category.userId === userId && canAddNewTaskToCategory(category, dateKey));
  const categoryIdForNewTask = validCategories.some(c => c.id === selectedCategoryId)
    ? selectedCategoryId : validCategories[0]?.id ?? '';
  const completedCount = completedTasks.length + legacyExecutions.length;

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save review.'); }
    finally { setBusy(false); }
  };
  const focusStage = (index: number) => {
    // Switching stages must never retain another stage's vertical scroll offset.
    if (overview || index !== activeStage) {
      const strip = scrollerRef.current;
      if (strip) strip.scrollTop = 0;
    }
    setActiveStage(index);
    setOverview(false);
  };

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

  const taskRow = (task: TaskDocument, compact: boolean) => {
    const category = categoryOfTask(task);
    return <div key={task.id} className={'min-w-0 rounded-lg bg-surfaceHighlight ' +
      (compact ? 'p-1.5' : 'p-2')} data-review-task-id={task.id}>
      <div className="flex min-w-0 items-start gap-1">
        <input type="checkbox" checked={task.completed} disabled={busy}
          aria-label={task.completed ? 'Mark incomplete: ' + task.title : 'Mark complete: ' + task.title}
          onChange={event => void run(() => toggleTaskCompletion(task.id, event.target.checked))}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border border-[#444444] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent)] disabled:opacity-40"
          style={{ accentColor: category?.color || 'var(--mosaic-accent)' }} />
        <button type="button" onClick={() => onOpenTask?.(task)}
          aria-label={'Actions for ' + task.title}
          className="min-w-0 flex-1 break-words text-left text-xs text-white focus-visible:outline focus-visible:underline">
          {task.title}
        </button>
      </div>
      <CategoryMark name={category?.name} color={category?.color} />
    </div>;
  };

  const legacyPlanRow = (plan: ReviewRecord, compact: boolean) => {
    const category = categoryOfRecord(plan);
    return <div key={plan.id} className="min-w-0 rounded-lg bg-surfaceHighlight p-2">
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
    {completedTasks.length === 0 && legacyExecutions.length === 0 &&
      <p className="text-xs text-gray-400">No completed tasks</p>}
    {completedTasks.map(task => taskRow(task, compact))}
    {legacyExecutions.map(item => <div key={item.id} className="rounded-lg bg-surfaceHighlight p-2">
      <div className="flex min-w-0 items-start gap-1">
        <Check size={15} aria-hidden="true" className="shrink-0 text-gray-300" />
        <span className="break-words text-xs text-white">{item.title}</span>
      </div>
      <CategoryMark {...(categoryOfRecord(item) ?? {})} />
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
        {validCategories.length > 0 && <MosaicSelect label="Task category" showSelectedColor value={categoryIdForNewTask}
          onChange={setSelectedCategoryId} options={validCategories.map(category => ({
            value: category.id, label: category.name, color: category.color,
          }))} />}
        <button type="submit" disabled={busy || !draftTask.trim() || !categoryIdForNewTask}
          className="rounded-lg bg-surfaceHighlight p-2 text-xs text-white disabled:opacity-40">
          <Plus size={14} aria-hidden="true" className="mr-1 inline" />Add task
        </button>
        {validCategories.length === 0 && <p className="text-xs text-gray-400">Create a category in Calendar first.</p>}
      </form>
      {availableTasks.length > 0 && <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-300">Reschedule an existing task</h4>
        <MosaicSelect label="Choose task" showSelectedColor value={selectedTaskId} onChange={setSelectedTaskId}
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
          })} className="w-full rounded-lg bg-surfaceHighlight p-2 text-xs disabled:opacity-40">
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
        className="rounded-lg bg-surfaceHighlight p-2 text-xs disabled:opacity-40">Add accomplishment</button>
    </form>
  </div>;

  const reflectionBody = <div className="min-w-0">
    {onSaveDiary && userId ? <DailyReviewDiaryEditor
      key={userId + ':' + dateKey} date={dateKey} userId={userId}
      entry={diaryEntry} onSave={onSaveDiary} onOpenFull={() => onOpenDiary(date)} /> :
      <button type="button" onClick={() => onOpenDiary(date)}
        className="mt-3 rounded-lg bg-surfaceHighlight p-2 text-xs">Open Diary</button>}
    <button type="button" disabled={busy}
      onClick={() => void run(() => finishReview(dateKey))}
      className="mt-4 w-full rounded-lg bg-surfaceHighlight p-3 text-xs font-semibold disabled:opacity-40">
      {reviewed ? 'Reviewed' : 'Finish review'}
    </button>
  </div>;

  const overviewBodies = [
    planItems(true),
    executionItems(true),
    <div className="mt-2 min-w-0 space-y-2 text-xs text-gray-300">
      <p className="break-words whitespace-pre-wrap">
        {diaryEntry?.content?.trim() || 'No Diary entry'}
      </p>
      {completedTasks.slice(0, 5).map(task => <p key={task.id} className="break-words text-gray-400">
        {task.title}
      </p>)}
    </div>,
  ];

  // Overview shows three side-by-side sections at every viewport width.
  // Focus occupies the entire workspace with exactly one visible section.
  // Both modes retain native vertical pan-y and instant stage switching.
  const columns = overview ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)';

  return <div className="swiper-no-swiping flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-3 text-white"
    data-testid="daily-review-workspace">
    <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
      <h2 className="mosaic-general-text text-sm font-semibold">Daily Review</h2>
      <button type="button" onClick={() => setOverview(value => !value)}
        aria-label={overview ? 'Focus daily review' : 'Show all three review stages'}
        aria-pressed={overview}
        className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-xs focus-visible:outline">
        {overview ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
        {overview ? 'Focus' : 'Overview'}
      </button>
    </div>
    {error && <p role="alert" className="mb-2 shrink-0 rounded-lg border border-red-500 p-2 text-xs">{error}</p>}
    <nav aria-label="Daily Review stages" className="mb-2 grid shrink-0 grid-cols-3 gap-2">
      {stages.map((stage, index) => <button type="button" key={stage}
        aria-current={!overview && activeStage === index ? 'step' : undefined}
        onClick={() => focusStage(index)}
        className={'rounded-lg px-1 py-2 text-xs focus-visible:outline ' +
          (!overview && activeStage === index ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}>
        {stage}
      </button>)}
    </nav>
    <div ref={scrollerRef} data-testid="daily-review-stage-strip"
      data-overview={overview || undefined}
      className="grid min-h-0 min-w-0 flex-1 items-start gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-3"
      style={{ scrollbarWidth: 'thin', touchAction: 'pan-y',
        gridTemplateColumns: columns, WebkitOverflowScrolling: 'touch' }}>
      {stages.map((stage, index) => <section key={stage}
        ref={node => { stageRefs.current[index] = node; }}
        hidden={!overview && index !== activeStage}
        aria-label={stage} data-review-stage={stage.toLowerCase()}
        onClick={event => {
          if (overview && !(event.target as Element).closest('button,input,textarea,select,a,[role="combobox"]'))
            focusStage(index);
        }}
        className="min-w-0 rounded-xl border border-[#333333] bg-surface p-2 transition-[background-color] duration-150"
        style={{ overflowWrap: 'anywhere' }}>
        <h3 className="mosaic-general-text min-w-0 text-xs font-semibold text-white">
          <button type="button" onClick={() => focusStage(index)}
            aria-label={'Focus ' + stage} className="w-full break-words text-left focus-visible:outline">
            {stage}
          </button>
        </h3>
        {overview ? overviewBodies[index] : activeStage === index ?
          [planBody, executionBody, reflectionBody][index] : null}
      </section>)}
    </div>
  </div>;
};
