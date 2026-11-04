import React, { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { BookOpenText, CheckCircle2, CircleDashed, Columns3, ListPlus, Maximize2, Minimize2 } from 'lucide-react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { useDailyReview } from '../../../hooks/useDailyReview';
import {
  executionForDay, outcomeForPlan, planForDay, reviewDay, taskCompletionOnDay,
  type ReviewResult
} from '../../../lib/dailyReviewModel';
import type { DiaryDocument, TaskDocument } from '../../../db/schema';

interface DailyReviewViewProps {
  date: Date;
  tasks: readonly TaskDocument[];
  diaryEntry?: DiaryDocument;
  onOpenDiary: (date: Date) => void;
}

const stages = ['Plan', 'Execution', 'Reflection'] as const;
const results: { value: ReviewResult; label: string }[] = [
  { value: 'completed', label: 'Done' },
  { value: 'partial', label: 'Partial' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const DailyReviewView: React.FC<DailyReviewViewProps> = ({ date, tasks, diaryEntry, onOpenDiary }) => {
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
  const plans = useMemo(() => planForDay(records, dateKey), [records, dateKey]);
  const executions = useMemo(() => executionForDay(records, dateKey), [records, dateKey]);
  const day = useMemo(() => reviewDay(records, dateKey), [records, dateKey]);
  const reviewed = Boolean(day?.reviewedAt);
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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save daily review.'); }
    finally { setBusy(false); }
  };

  const chooseStage = (index: number) => {
    setOverview(false);
    setActiveStage(index);
    requestAnimationFrame(() => {
      stageRefs.current[index]?.scrollIntoView({
        block: 'nearest', inline: 'start',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
  };

  const stageTitle = (index: number) => (
    <h3 className="mosaic-general-text flex items-center justify-between text-base font-semibold text-white">
      <span>{stages[index]}</span><span className="text-xs font-normal text-gray-400">{index + 1} / 3</span>
    </h3>
  );

  const planPanel = (
    <section ref={element => { stageRefs.current[0] = element; }} aria-label="Plan" data-review-stage="plan"
      className="w-[calc(100%-1.25rem)] shrink-0 snap-start rounded-xl border border-[#333333] bg-surface p-3 md:w-auto md:min-w-0 md:shrink md:snap-none">
      {stageTitle(0)}
      <p className="mt-2 text-xs text-gray-400">Your intentions on this date, preserved when tasks move later.</p>
      {isLoading ? <p className="mt-4 text-sm text-gray-400">Loading plan…</p> : (
        <>
          {plans.length === 0 && <p className="mt-4 text-sm text-gray-400">No plan recorded yet.</p>}
          <div className="mt-3 space-y-2">
            {plans.map(plan => (
              <div key={plan.id} className="rounded-lg bg-surfaceHighlight p-3">
                <p className="break-words text-sm text-white">{plan.title}</p>
                <span className="text-xs text-gray-400">{plan.taskId ? 'Linked task' : 'Independent plan item'}</span>
              </div>
            ))}
          </div>
          {scheduled.length > 0 && <div className="mt-4 space-y-1">
            <p className="text-xs text-gray-400">{scheduled.length} scheduled task(s) not yet in this plan</p>
            {scheduled.slice(0, 8).map(task => (
              <button key={task.id} type="button" disabled={busy} onClick={() => void run(() => addPlan(dateKey, task.title, task.id))}
                className="flex w-full items-center gap-2 rounded-lg bg-surfaceHighlight p-2 text-left text-sm text-white focus-visible:outline">
                <ListPlus size={16} aria-hidden="true" />{task.title}
              </button>
            ))}
          </div>}
          <button type="button" disabled={busy} onClick={() => void run(() => confirmPlan(dateKey, tasks))}
            className="mt-3 w-full rounded-lg bg-surfaceHighlight px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {day?.plannedAt ? 'Refresh scheduled plan' : 'Set plan from scheduled tasks'}
          </button>
          {available.length > 0 && <div className="mt-4 flex flex-col gap-2">
            <MosaicSelect label="Plan an existing task on this day" value={selectedTaskId}
              onChange={setSelectedTaskId} options={[{ value: '', label: 'Choose an existing task' },
                ...available.slice(0, 150).map(task => ({ value: task.id, label: task.title }))]} />
            <button type="button" disabled={busy || !selectedTaskId} onClick={() => void run(async () => {
              const task = available.find(candidate => candidate.id === selectedTaskId);
              if (task) await addPlan(dateKey, task.title, task.id);
              setSelectedTaskId('');
            })} className="rounded-lg bg-surfaceHighlight px-3 py-2 text-sm text-white disabled:opacity-40">
              Add selected task to this day
            </button>
          </div>}
          <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void run(async () => {
            await addPlan(dateKey, draftPlan); setDraftPlan('');
          }); }}>
            <input aria-label="Independent plan item" value={draftPlan} onChange={event => setDraftPlan(event.target.value)}
              maxLength={255} placeholder="Add a plan item" className="min-w-0 flex-1 rounded-lg border border-[#444444] bg-surfaceHighlight px-3 py-2 text-sm text-white" />
            <button type="submit" disabled={busy || !draftPlan.trim()} className="rounded-lg bg-surfaceHighlight px-3 text-sm text-white disabled:opacity-40">Add</button>
          </form>
        </>
      )}
    </section>
  );

  const executionPanel = (
    <section ref={element => { stageRefs.current[1] = element; }} aria-label="Execution" data-review-stage="execution"
      className="w-[calc(100%-1.25rem)] shrink-0 snap-start rounded-xl border border-[#333333] bg-surface p-3 md:w-auto md:min-w-0 md:shrink md:snap-none">
      {stageTitle(1)}
      <p className="mt-2 text-xs text-gray-400">Record actual work. A later accomplishment does not rewrite a previous day.</p>
      <p className="mt-3 text-sm text-gray-300">{completedCount} of {plans.length} planned items recorded as completed</p>
      <div className="mt-3 space-y-3">
        {plans.map(plan => {
          const outcome = outcomeForPlan(records, plan, reviewed);
          return <div key={plan.id} className="rounded-lg bg-surfaceHighlight p-3">
            <p className="break-words text-sm text-white">{plan.title}</p>
            <p className="mt-1 text-xs text-gray-400">Outcome: {outcome === 'not-recorded' ? 'Not recorded' : outcome}</p>
            <input aria-label={'Outcome note for ' + plan.title} maxLength={2000}
              value={noteByPlan[plan.id] ?? ''} onChange={event => setNoteByPlan(current => ({ ...current, [plan.id]: event.target.value }))}
              placeholder="Optional note" className="mt-2 w-full rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-sm text-white" />
            <div className="mt-2 flex flex-wrap gap-1">
              {results.map(choice => <button key={choice.value} type="button" disabled={busy}
                onClick={() => void run(() => recordOutcome(dateKey, choice.value, plan.title, plan.taskId, plan.id, noteByPlan[plan.id] ?? ''))}
                className="rounded-md border border-[#444444] px-2 py-1.5 text-xs text-white disabled:opacity-40">
                {choice.label}
              </button>)}
            </div>
          </div>;
        })}
        {plans.length === 0 && <p className="text-sm text-gray-400">No planned work to review.</p>}
      </div>
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-semibold text-white">Unplanned accomplishments</h4>
        {unplanned.map(item => <div key={item.id} className="rounded-lg bg-surfaceHighlight p-2 text-sm text-white">
          <CheckCircle2 size={16} aria-hidden="true" className="mr-2 inline" />{item.title}
        </div>)}
        {taskSuggestions.map(task => (
          <button key={task.id} type="button" disabled={busy} onClick={() => void run(() =>
            recordOutcome(dateKey, 'completed', task.title, task.id))}
            className="block w-full rounded-lg bg-surfaceHighlight p-2 text-left text-sm text-white">
            Record completed task: {task.title}
          </button>
        ))}
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void run(async () => {
          await recordOutcome(dateKey, 'completed', draftExecution); setDraftExecution('');
        }); }}>
          <input aria-label="Unplanned accomplishment" value={draftExecution}
            onChange={event => setDraftExecution(event.target.value)}
            maxLength={255} placeholder="Something else you did" className="min-w-0 flex-1 rounded-lg border border-[#444444] bg-surfaceHighlight px-3 py-2 text-sm text-white" />
          <button type="submit" disabled={busy || !draftExecution.trim()}
            className="rounded-lg bg-surfaceHighlight px-3 text-sm text-white disabled:opacity-40">Record</button>
        </form>
      </div>
    </section>
  );

  const reflectionPanel = (
    <section ref={element => { stageRefs.current[2] = element; }} aria-label="Reflection" data-review-stage="reflection"
      className="w-[calc(100%-1.25rem)] shrink-0 snap-start rounded-xl border border-[#333333] bg-surface p-3 md:w-auto md:min-w-0 md:shrink md:snap-none">
      {stageTitle(2)}
      <p className="mt-2 text-xs text-gray-400">What went well? What would you change tomorrow?</p>
      <div className="mt-3 rounded-lg bg-surfaceHighlight p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <BookOpenText size={18} aria-hidden="true" />Your Diary
        </div>
        <p className="mt-2 max-h-48 overflow-hidden whitespace-pre-wrap break-words text-sm text-gray-300">
          {diaryEntry?.content?.trim() || 'No Diary entry recorded for this day.'}
        </p>
        <button type="button" onClick={() => onOpenDiary(date)}
          className="mt-3 w-full rounded-lg border border-[#444444] px-3 py-2 text-sm text-white">
          {diaryEntry ? 'Open Diary entry' : 'Write Diary entry'}
        </button>
        <p className="mt-2 text-xs text-gray-400">Diary visibility remains under your existing Diary controls.</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void run(() => finishReview(dateKey))}
        className="mt-4 w-full rounded-lg bg-surfaceHighlight px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">
        {reviewed ? 'Update review completion time' : 'Finish daily review'}
      </button>
      {reviewed && <p className="mt-2 text-xs text-gray-400">
        Review recorded. Unreported planned items are shown as missed, but outcomes can still be corrected.
      </p>}
    </section>
  );

  const panels = [planPanel, executionPanel, reflectionPanel];
  return <div className="swiper-no-swiping min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 text-white" data-testid="daily-review-workspace">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div>
        <h2 className="mosaic-general-text text-sm font-semibold">Daily Review</h2>
        <p className="text-xs text-gray-400">{format(date, 'EEEE, MMM d')}</p>
      </div>
      <button type="button" onClick={() => setOverview(value => !value)}
        aria-label={overview ? 'Focus daily review' : 'Show all three review stages'}
        aria-pressed={overview} className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm focus-visible:outline">
        {overview ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        {overview ? 'Focus' : 'Overview'}
      </button>
    </div>
    {error && <p role="alert" className="mb-3 rounded-lg border border-red-500 p-2 text-sm">{error}</p>}
    {overview ? (
      <div className="grid grid-cols-3 gap-2" data-testid="daily-review-overview">
        {stages.map((stage, index) => <button key={stage} type="button"
          onClick={() => chooseStage(index)} aria-label={'Focus ' + stage}
          className="min-w-0 rounded-xl border border-[#444444] bg-surface p-2 text-left focus-visible:outline">
          <span className="block break-words text-xs font-semibold">{stage}</span>
          <span className="mt-2 block text-xs text-gray-400">
            {index === 0 ? plans.length + ' planned' : index === 1 ? completedCount + ' completed; ' + unplanned.length + ' unplanned' :
              diaryEntry ? 'Diary recorded' : 'No Diary'}
          </span>
        </button>)}
      </div>
    ) : (
      <>
        <nav aria-label="Daily Review stages" className="mb-3 flex gap-2 md:hidden">
          {stages.map((stage, index) => <button type="button" key={stage}
            aria-current={activeStage === index ? 'step' : undefined}
            onClick={() => chooseStage(index)}
            className={'flex-1 rounded-lg px-2 py-2 text-xs ' +
              (activeStage === index ? 'bg-surfaceHighlight text-white' : 'bg-surface text-gray-400')}>{stage}</button>)}
        </nav>
        <div ref={scrollerRef} onScroll={event => {
          if (window.innerWidth >= 768) return;
          const element = event.currentTarget;
          const left = element.scrollLeft;
          const distances = stageRefs.current.map(stage => stage ? Math.abs(stage.offsetLeft - stageRefs.current[0]!.offsetLeft - left) : Infinity);
          const closest = distances.indexOf(Math.min(...distances));
          if (closest >= 0) setActiveStage(closest);
        }}
          className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 md:grid md:grid-cols-3 md:items-start md:overflow-visible md:snap-none"
          data-testid="daily-review-stage-strip" style={{ scrollbarWidth: 'none', scrollPaddingInline: '0px' }}>
          {panels}
        </div>
      </>
    )}
    <p className="mt-3 flex items-center gap-2 text-xs text-gray-400 md:hidden">
      {overview ? <Columns3 size={14} /> : <CircleDashed size={14} />}
      {overview ? 'Tap a stage to expand it.' : 'Swipe sideways to compare. Overview shows all three.'}
    </p>
  </div>;
};
