import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ListPlus, Maximize2, Minimize2 } from 'lucide-react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { useDailyReview } from '../../../hooks/useDailyReview';
import { DailyReviewDiaryEditor } from './DailyReviewDiaryEditor';
import {
  executionForDay, outcomeForPlan, planForDay, reviewDay, taskCompletionOnDay,
  type ReviewRecord, type ReviewResult
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
}

const stages = ['Plan', 'Execution', 'Reflection'] as const;
const results: { value: ReviewResult; label: string }[] = [
  { value: 'completed', label: 'Done' },
  { value: 'partial', label: 'Partial' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CategoryMark: React.FC<{ name?: string; color?: string }> = ({ name, color }) =>
  name ? <span className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-gray-400">
    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color || 'var(--mosaic-text-muted, #9CA3AF)' }} />
    <span className="truncate">{name}</span>
  </span> : null;

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({
  date, tasks, categories = [], diaryEntry, onSaveDiary, onOpenDiary, userId = '',
}) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const { records, isLoading, addPlan, confirmPlan, recordOutcome, finishReview } = useDailyReview();
  const [overview, setOverview] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [draftPlan, setDraftPlan] = useState('');
  const [draftExecution, setDraftExecution] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [noteByPlan, setNoteByPlan] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stageRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const requestedFocusRef = useRef<number | null>(null);
  const plans = useMemo(() => planForDay(records, dateKey), [records, dateKey]);
  const executions = useMemo(() => executionForDay(records, dateKey), [records, dateKey]);
  const day = useMemo(() => reviewDay(records, dateKey), [records, dateKey]);
  const reviewed = Boolean(day?.reviewedAt);
  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const categoryOfTask = (task: TaskDocument) => categoriesById.get(task.categoryId);
  const categoryOfRecord = (record: ReviewRecord) => {
    if (record.categoryName) return { name: record.categoryName, color: record.categoryColor };
    const task = tasksById.get(record.taskId);
    return task ? categoryOfTask(task) : undefined;
  };
  const plannedTaskIds = new Set(plans.map(plan => plan.taskId).filter(Boolean));
  const scheduled = tasks.filter(task => !task.isDeleted && task.date === dateKey && !plannedTaskIds.has(task.id));
  const available = tasks.filter(task => !task.isDeleted && !plannedTaskIds.has(task.id));
  const unplanned = executions.filter(item => !item.planId && item.result === 'completed');
  const taskSuggestions = tasks.filter(task => !task.isDeleted && taskCompletionOnDay(task, dateKey) &&
    !executions.some(record => record.taskId === task.id && record.result === 'completed') &&
    !plans.some(plan => plan.taskId === task.id));
  const completedCount = plans.filter(plan => outcomeForPlan(records, plan, reviewed) === 'completed').length;

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save review.'); }
    finally { setBusy(false); }
  };

  const addTaskPlan = async (task: TaskDocument) => {
    const category = categoryOfTask(task);
    await addPlan(dateKey, task.title, task.id, category?.name ?? '', category?.color ?? '');
  };

  // This effect moves ONLY the inner Daily Review scroller, never the parent
  // Swiper or window. scrollIntoView() is prohibited for stage navigation.
  useLayoutEffect(() => {
    const index = requestedFocusRef.current;
    if (index === null || overview) return;
    requestedFocusRef.current = null;
    if (typeof window === 'undefined' || window.matchMedia?.('(min-width: 768px)').matches) return;
    const strip = scrollerRef.current;
    const first = stageRefs.current[0];
    const target = stageRefs.current[index];
    if (!strip || !first || !target) return;
    strip.scrollTo({
      left: target.offsetLeft - first.offsetLeft,
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [overview, activeStage]);

  const focusStage = (index: number) => {
    requestedFocusRef.current = index;
    setActiveStage(index);
    setOverview(false);
  };

  const planBody = <>
    {isLoading ? <p className="mt-3 text-sm text-gray-400">Loading…</p> : <>
      {plans.length === 0 && <p className="mt-3 text-sm text-gray-400">No plan yet</p>}
      <div className="mt-3 space-y-2">
        {plans.map(plan => <div key={plan.id} className="rounded-lg bg-surfaceHighlight p-3">
          <p className="break-words text-sm text-white">{plan.title}</p>
          <CategoryMark {...(categoryOfRecord(plan) ?? {})} />
        </div>)}
      </div>
      {scheduled.length > 0 && <div className="mt-4 space-y-1">
        <h4 className="text-xs font-medium text-gray-400">Scheduled tasks</h4>
        {scheduled.slice(0, 8).map(task => <button key={task.id} type="button" disabled={busy}
          onClick={() => void run(() => addTaskPlan(task))}
          className="flex w-full items-start gap-2 rounded-lg bg-surfaceHighlight p-2 text-left text-sm text-white focus-visible:outline">
          <ListPlus size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0"><span className="block break-words">{task.title}</span>
            <CategoryMark {...(categoryOfTask(task) ?? {})} /></span>
        </button>)}
      </div>}
      <button type="button" disabled={busy} onClick={() => void run(() => confirmPlan(dateKey, tasks, categories))}
        className="mt-3 w-full rounded-lg bg-surfaceHighlight px-3 py-2 text-sm text-white disabled:opacity-50">
        {day?.plannedAt ? 'Refresh plan' : 'Import scheduled tasks'}
      </button>
      {available.length > 0 && <div className="mt-4 flex flex-col gap-2">
        <MosaicSelect label="Choose task" value={selectedTaskId}
          onChange={setSelectedTaskId} options={[{ value: '', label: 'Choose task' },
            ...available.slice(0, 150).map(task => ({ value: task.id, label: task.title }))]} />
        <button type="button" disabled={busy || !selectedTaskId} onClick={() => void run(async () => {
          const task = available.find(candidate => candidate.id === selectedTaskId);
          if (task) await addTaskPlan(task);
          setSelectedTaskId('');
        })} className="rounded-lg bg-surfaceHighlight px-3 py-2 text-sm text-white disabled:opacity-40">
          Add task
        </button>
      </div>}
      <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void run(async () => {
        await addPlan(dateKey, draftPlan); setDraftPlan('');
      }); }}>
        <input aria-label="Independent plan item" value={draftPlan} onChange={event => setDraftPlan(event.target.value)}
          maxLength={255} placeholder="New plan" className="min-w-0 flex-1 rounded-lg border border-[#444444] bg-surfaceHighlight px-3 py-2 text-sm text-white" />
        <button type="submit" disabled={busy || !draftPlan.trim()} className="rounded-lg bg-surfaceHighlight px-3 text-sm text-white disabled:opacity-40">Add</button>
      </form>
    </>}
  </>;

  const executionBody = <>
    <p className="mt-3 text-xs text-gray-400">{completedCount} / {plans.length} done</p>
    <div className="mt-3 space-y-3">
      {plans.map(plan => {
        const outcome = outcomeForPlan(records, plan, reviewed);
        const category = categoryOfRecord(plan);
        return <div key={plan.id} className="rounded-lg bg-surfaceHighlight p-3">
          <p className="break-words text-sm text-white">{plan.title}</p>
          <CategoryMark {...(category ?? {})} />
          <p className="mt-1 text-xs text-gray-400">
            {outcome === 'not-recorded' ? 'Not recorded' : outcome === 'completed' ? 'Done' : outcome}
          </p>
          <input aria-label={'Outcome note for ' + plan.title} maxLength={2000}
            value={noteByPlan[plan.id] ?? ''}
            onChange={event => setNoteByPlan(current => ({ ...current, [plan.id]: event.target.value }))}
            placeholder="Note (optional)" className="mt-2 w-full rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-sm text-white" />
          <div className="mt-2 flex flex-wrap gap-1">
            {results.map(choice => <button key={choice.value} type="button" disabled={busy}
              onClick={() => void run(() => recordOutcome(dateKey, choice.value, plan.title, plan.taskId,
                plan.id, noteByPlan[plan.id] ?? '', category?.name ?? '', category?.color ?? ''))}
              className="rounded-md border border-[#444444] px-2 py-1.5 text-xs text-white disabled:opacity-40">
              {choice.label}
            </button>)}
          </div>
        </div>;
      })}
    </div>
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-semibold text-white">Other accomplishments</h4>
      {unplanned.map(item => <div key={item.id} className="rounded-lg bg-surfaceHighlight p-2 text-sm text-white">
        <span className="flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" />{item.title}</span>
        <CategoryMark {...(categoryOfRecord(item) ?? {})} />
      </div>)}
      {taskSuggestions.map(task => {
        const category = categoryOfTask(task);
        return <button key={task.id} type="button" disabled={busy}
          onClick={() => void run(() => recordOutcome(dateKey, 'completed', task.title, task.id,
            '', '', category?.name ?? '', category?.color ?? ''))}
          className="block w-full rounded-lg bg-surfaceHighlight p-2 text-left text-sm text-white">
          <span className="block">Record: {task.title}</span><CategoryMark {...(category ?? {})} />
        </button>;
      })}
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void run(async () => {
        await recordOutcome(dateKey, 'completed', draftExecution); setDraftExecution('');
      }); }}>
        <input aria-label="Unplanned accomplishment" value={draftExecution}
          onChange={event => setDraftExecution(event.target.value)}
          maxLength={255} placeholder="Add accomplishment"
          className="min-w-0 flex-1 rounded-lg border border-[#444444] bg-surfaceHighlight px-3 py-2 text-sm text-white" />
        <button type="submit" disabled={busy || !draftExecution.trim()}
          className="rounded-lg bg-surfaceHighlight px-3 text-sm text-white disabled:opacity-40">Add</button>
      </form>
    </div>
  </>;

  const reflectionBody = <>
    {onSaveDiary && userId ? <DailyReviewDiaryEditor
      key={userId + ':' + dateKey} date={dateKey} userId={userId}
      entry={diaryEntry} onSave={onSaveDiary} onOpenFull={() => onOpenDiary(date)} /> :
      <button type="button" onClick={() => onOpenDiary(date)}
        className="mt-3 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm text-white">Open Diary</button>}
    <button type="button" disabled={busy} onClick={() => void run(() => finishReview(dateKey))}
      className="mt-4 w-full rounded-lg bg-surfaceHighlight px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">
      {reviewed ? 'Reviewed' : 'Finish review'}
    </button>
  </>;

  const summaries = [
    plans.length + ' planned',
    completedCount + ' done · ' + unplanned.length + ' extra',
    diaryEntry?.content?.trim() ? 'Diary recorded' : 'No Diary',
  ];
  const bodies = [planBody, executionBody, reflectionBody];
  const reduceMotion = typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.26, ease: 'easeInOut' as const };
  const gridColumns = stages.map((_, index) =>
    !overview && index === activeStage ? '1.55fr' : '1fr').join(' ');

  return <div className="swiper-no-swiping min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4 text-white"
    data-testid="daily-review-workspace">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="mosaic-general-text text-sm font-semibold">Daily Review</h2>
      <button type="button" onClick={() => setOverview(value => !value)}
        aria-label={overview ? 'Focus daily review' : 'Show all three review stages'}
        aria-pressed={overview}
        className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm focus-visible:outline">
        {overview ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        {overview ? 'Focus' : 'Overview'}
      </button>
    </div>
    {error && <p role="alert" className="mb-3 rounded-lg border border-red-500 p-2 text-sm">{error}</p>}
    {!overview && <nav aria-label="Daily Review stages" className="mb-3 flex gap-2 md:hidden">
      {stages.map((stage, index) => <button type="button" key={stage}
        aria-current={activeStage === index ? 'step' : undefined}
        onClick={() => focusStage(index)}
        className={'flex-1 rounded-lg px-2 py-2 text-xs ' +
          (activeStage === index ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}>{stage}</button>)}
    </nav>}
    <div ref={scrollerRef} data-testid="daily-review-stage-strip"
      data-overview={overview || undefined}
      onScroll={event => {
        if (overview || (typeof window !== 'undefined' && window.innerWidth >= 768)) return;
        const strip = event.currentTarget;
        const first = stageRefs.current[0];
        if (!first) return;
        const nearest = stageRefs.current.map(section =>
          section ? Math.abs(section.offsetLeft - first.offsetLeft - strip.scrollLeft) : Infinity);
        const index = nearest.indexOf(Math.min(...nearest));
        if (index >= 0 && index !== activeStage) setActiveStage(index);
      }}
      className={overview
        ? 'grid min-w-0 grid-cols-3 gap-2 overflow-hidden pb-3'
        : 'flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 md:grid md:items-start md:overflow-visible md:snap-none'}
      style={{ scrollbarWidth: 'none', gridTemplateColumns: gridColumns }}>
      {stages.map((stage, index) => <motion.section key={stage} layout
        ref={node => { stageRefs.current[index] = node; }}
        initial={false} transition={transition}
        aria-label={stage} data-review-stage={stage.toLowerCase()}
        className={'min-w-0 rounded-xl border border-[#333333] bg-surface p-3 ' +
          (overview ? '' : 'w-[calc(100%-1.25rem)] shrink-0 snap-start md:w-auto md:shrink md:snap-none')}>
        <AnimatePresence initial={false} mode="wait">
          {overview ? <motion.button key="summary" type="button" onClick={() => focusStage(index)}
            aria-label={'Focus ' + stage}
            initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={transition} className="block w-full min-w-0 text-left focus-visible:outline">
            <span className="block break-words text-xs font-semibold text-white">{stage}</span>
            <span className="mt-2 block break-words text-xs text-gray-400">{summaries[index]}</span>
          </motion.button> : <motion.div key="full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={transition}>
            <h3 className="mosaic-general-text text-base font-semibold text-white">
              <button type="button" onClick={() => focusStage(index)}
                aria-label={'Focus ' + stage} className="text-left focus-visible:outline">{stage}</button>
            </h3>
            {bodies[index]}
          </motion.div>}
        </AnimatePresence>
      </motion.section>)}
    </div>
  </div>;
};
