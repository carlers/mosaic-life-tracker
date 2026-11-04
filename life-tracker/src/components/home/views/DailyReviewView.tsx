import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, ListPlus, Maximize2, Minimize2 } from 'lucide-react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { useDailyReview } from '../../../hooks/useDailyReview';
import { scrollReviewStripToStage } from '../../../lib/dailyReviewStageScroll';
import { reviewPinchIntent, reviewTouchDistance } from '../../../lib/dailyReviewPinch';
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
    if (record.categoryName !== undefined)
      return record.categoryName ? { name: record.categoryName, color: record.categoryColor } : undefined;
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
    const strip = scrollerRef.current;
    const first = stageRefs.current[0];
    const target = stageRefs.current[index];
    if (!strip || !first || !target) return;
    scrollReviewStripToStage(strip, first, target);
    const alignAfterResize = (event: TransitionEvent) => {
      if (event.target !== target || event.propertyName !== 'flex-basis') return;
      // Re-align after panels finish expanding without scrolling ancestors.
      if (typeof window !== 'undefined' && window.innerWidth < 768)
        strip.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: 'auto' });
    };
    target.addEventListener('transitionend', alignAfterResize);
    return () => target.removeEventListener('transitionend', alignAfterResize);
  }, [overview, activeStage]);

  const focusStage = (index: number) => {
    requestedFocusRef.current = index;
    setActiveStage(index);
    setOverview(false);
  };

  // Two-finger gestures are local to the review strip. Native page magnification
  // remains available outside it, and one-finger x/y scrolling is never cancelled.
  useEffect(() => {
    const strip = scrollerRef.current;
    if (!strip) return;
    let pinch: { start: number; current: number; centerX: number } | null = null;
    const start = (event: TouchEvent) => {
      pinch = null;
      if (event.touches.length !== 2 ||
          (event.target as Element).closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const distance = reviewTouchDistance(event.touches);
      if (distance >= 40) pinch = {
        start: distance, current: distance,
        centerX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
      };
    };
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      const current = reviewTouchDistance(event.touches);
      if (Math.abs(current - pinch.start) < 8) return;
      if (event.cancelable) event.preventDefault();
      pinch.current = current;
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
      if ((event as Event).cancelable) event.preventDefault();
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
            {outcome === 'completed' ? 'Done' : outcome === 'not-recorded' ? 'Not recorded' : 'Not done'}
          </p>
          <input aria-label={'Outcome note for ' + plan.title} maxLength={2000}
            value={noteByPlan[plan.id] ?? ''}
            onChange={event => setNoteByPlan(current => ({ ...current, [plan.id]: event.target.value }))}
            placeholder="Note (optional)" className="mt-2 w-full rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-sm text-white" />
          <button type="button" disabled={busy}
            onClick={() => void run(() => recordOutcome(dateKey, outcome === 'completed' ? 'missed' : 'completed',
              plan.title, plan.taskId, plan.id, noteByPlan[plan.id] ?? '',
              category?.name ?? '', category?.color ?? ''))}
            className="mt-2 rounded-lg border border-[#444444] px-3 py-2 text-xs text-white disabled:opacity-40">
            {outcome === 'completed' ? 'Undo' : 'Done'}
          </button>
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

  return <div className="swiper-no-swiping flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4 text-white"
    data-testid="daily-review-workspace">
    <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
      <h2 className="mosaic-general-text text-sm font-semibold">Daily Review</h2>
      <button type="button" onClick={() => setOverview(value => !value)}
        aria-label={overview ? 'Focus daily review' : 'Show all three review stages'}
        aria-pressed={overview}
        className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm focus-visible:outline">
        {overview ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        {overview ? 'Focus' : 'Overview'}
      </button>
    </div>
    {error && <p role="alert" className="mb-3 shrink-0 rounded-lg border border-red-500 p-2 text-sm">{error}</p>}
    {!overview && <nav aria-label="Daily Review stages" className="mb-3 flex shrink-0 gap-2 md:hidden">
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
      className={'flex min-h-0 min-w-0 flex-1 items-start gap-3 overflow-x-auto overflow-y-auto overscroll-contain pb-3 ' +
        (overview ? 'snap-none' : 'snap-x snap-mandatory md:snap-none')}
      style={{ scrollbarWidth: 'none', touchAction: 'pan-x pan-y' }}>
      {stages.map((stage, index) => <section key={stage}
        ref={node => { stageRefs.current[index] = node; }}
        aria-label={stage} data-review-stage={stage.toLowerCase()}
        className="min-w-0 shrink-0 snap-start overflow-hidden rounded-xl border border-[#333333] bg-surface p-3 transition-[flex-basis,flex-grow] duration-300 ease-out motion-reduce:transition-none md:!basis-0 md:shrink md:snap-none"
        style={{
          flexBasis: overview ? 'calc((100% - 1.5rem) / 3)' : 'calc(100% - 1.25rem)',
          flexGrow: overview ? 1 : index === activeStage ? 1.55 : 1,
        }}>
        <h3 className="mosaic-general-text text-base font-semibold text-white">
          <button type="button" onClick={() => focusStage(index)}
            aria-label={'Focus ' + stage} className="text-left focus-visible:outline">{stage}</button>
        </h3>
        <div aria-hidden={!overview} className={'overflow-hidden text-xs text-gray-400 transition-[max-height,opacity,margin] duration-200 motion-reduce:transition-none ' +
          (overview ? 'mt-2 max-h-24 opacity-100' : 'mt-0 max-h-0 opacity-0')}>
          {summaries[index]}
        </div>
        <div aria-hidden={overview} inert={overview}
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: overview ? '0fr' : '1fr', opacity: overview ? 0 : 1 }}>
          <div className="min-h-0 overflow-hidden">{bodies[index]}</div>
        </div>
      </section>)}
    </div>
  </div>;
};
