import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Pencil } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { useDiary } from '../../hooks/useDiary';
import { AppearanceContext } from '../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../lib/motionPreferences';
import { useSettings } from '../../hooks/useSettings';
import { WEEK_STARTS_ON_SUNDAY_SETTING_KEY } from '../../lib/preferences';
import { WidgetLayoutGrid } from './WidgetLayoutGrid';
import { TodayDiaryWidget, HeavyCategoriesWidget, WeeklyProgressWidget } from './WidgetCards';
import { selectCategoryLoadsForDays, selectTodayDiaryEntries, selectTaskPeriodProgress } from '../../lib/widgetDashboardData';
import type { CategoryRangeDays, WidgetProgressPeriod } from '../../lib/widgetDashboardData';
import {
  WIDGET_LAYOUT_SETTING_KEY, resolveWidgetLayout, toWidgetLayoutPreference, widgetLayoutsEqual,
  type WidgetLayoutItem, type WidgetId,
} from '../../lib/widgetLayout';
import type { CategoryDocument, TaskDocument } from '../../db/schema';
import { getLocalTodayKey, getTodayWidgetProgress, selectTodayWidgetTasks } from '../../lib/todayWidget';

interface WidgetsPageProps {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  onOpenToday: () => void;
  onOpenDiary?: () => void;
  isActive?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
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
  onOpenToday: () => void;
}

const TodayRow = React.memo<TodayRowProps>(({ task, color, disabled, onToggle, onOpenToday }) => (
  <li className="flex min-w-0 items-start gap-3 py-2">
    <button
      type="button"
      role="checkbox"
      data-widget-checkbox="true"
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
    <button type="button" onClick={onOpenToday}
      aria-label={'Open today in Calendar: ' + (task.title || 'Untitled task')}
      className={'min-w-0 flex-1 break-words rounded text-left text-sm leading-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ' +
        (task.completed ? 'text-gray-400 line-through' : 'text-white')}>
      {task.title}
    </button>
  </li>
));
TodayRow.displayName = 'TodayRow';

/** Lazy Home-neighbor panel: reuses the one owner Home subscription and existing completion domain command. */
export const WidgetsPage: React.FC<WidgetsPageProps> = ({
  tasks, categories, onOpenToday, onOpenDiary = onOpenToday,
  isActive = true, editing = false, onEditingChange = () => {},
}) => {
  // Preload the tiny gesture helper only after the user first opens Widgets.
  useEffect(() => {
    void import('../../lib/widgetSlideSettle').catch(() => {});
    void import('../../lib/widgetCalendarReveal').catch(() => {});
  }, []);
  const { user } = useAuth();
  const appearance = React.useContext(AppearanceContext);
  const reducedMotion = appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion();
  const ownerId = user?.$id ?? '';
  const dayKey = useLocalToday();
  const { toggleTaskCompletion } = useTasks(false);
  const { entries } = useDiary(isActive);
  const { settings, setSetting } = useSettings();
  const savedLayout = useMemo(() => resolveWidgetLayout(settings[WIDGET_LAYOUT_SETTING_KEY]), [settings]);
  const [localLayout, setLocalLayout] = useState<{ ownerId: string; items: WidgetLayoutItem[] } | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [categoryRangeDays, setCategoryRangeDays] = useState<CategoryRangeDays>(7);
  const [progressPeriod, setProgressPeriod] = useState<WidgetProgressPeriod>('week');
  const writeVersionRef = useRef(0);
  const activeOwnerRef = useRef(ownerId);
  React.useLayoutEffect(() => { activeOwnerRef.current = ownerId; }, [ownerId]);
  const layoutSaveTailRef = useRef<Promise<void>>(Promise.resolve());
  const [savedRevision, setSavedRevision] = useState<{ ownerId: string; revision: number } | null>(null);
  const layout = localLayout?.ownerId === ownerId ? localLayout.items : savedLayout;
  const calendarDate = useMemo(() => {
    const [year, month, day] = dayKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [dayKey]);
  const diaryToday = useMemo(() => selectTodayDiaryEntries(entries, ownerId, calendarDate),
    [entries, ownerId, calendarDate]);
  const heaviestCategories = useMemo(() =>
    selectCategoryLoadsForDays(tasks, categories, ownerId, calendarDate, categoryRangeDays),
    [tasks, categories, ownerId, calendarDate, categoryRangeDays]);
  const weekStartsOnSunday = settings[WEEK_STARTS_ON_SUNDAY_SETTING_KEY] !== false;
  const progressByPeriod = useMemo(() =>
    selectTaskPeriodProgress(tasks, ownerId, calendarDate, weekStartsOnSunday, progressPeriod),
    [tasks, ownerId, calendarDate, weekStartsOnSunday, progressPeriod]);
  const previewLayout = useCallback((next: WidgetLayoutItem[]) => {
    if (!ownerId) return;
    setLocalLayout({ ownerId, items: next });
    setLayoutError(null);
  }, [ownerId]);
  const commitLayout = useCallback((next: WidgetLayoutItem[]) => {
    if (!ownerId) return;
    const ownerAtStart = ownerId;
    const revision = ++writeVersionRef.current;
    const preference = toWidgetLayoutPreference(next);
    // One local write on each release, serialized to keep the LAST drag as
    // the final setting even when earlier writes finish out of order.
    const save = async () => {
      if (activeOwnerRef.current !== ownerAtStart) return;
      await setSetting(WIDGET_LAYOUT_SETTING_KEY, preference);
    };
    layoutSaveTailRef.current = layoutSaveTailRef.current.then(save, save).then(
      () => {
        if (revision === writeVersionRef.current && activeOwnerRef.current === ownerAtStart) {
          setSavedRevision({ ownerId: ownerAtStart, revision });
        }
      },
      () => {
        if (revision === writeVersionRef.current && activeOwnerRef.current === ownerAtStart) {
          setLocalLayout(null);
          setLayoutError(ownerAtStart);
        }
      }
    );
  }, [ownerId, setSetting]);
  useEffect(() => {
    if (localLayout?.ownerId !== ownerId ||
      savedRevision?.ownerId !== ownerId ||
      savedRevision.revision !== writeVersionRef.current ||
      !widgetLayoutsEqual(localLayout.items, savedLayout)) return;
    // Wait for both the latest write and the matching local settings emission.
    // Never briefly show an older arrangement after rapid drag/resize edits.
    queueMicrotask(() => setLocalLayout(current =>
      current?.ownerId === ownerId && widgetLayoutsEqual(current.items, savedLayout)
        ? null : current));
  }, [ownerId, localLayout, savedLayout, savedRevision]);
  useEffect(() => { writeVersionRef.current += 1; }, [ownerId]);
  const rows = useMemo(() => selectTodayWidgetTasks(tasks, categories, ownerId, dayKey), [tasks, categories, ownerId, dayKey]);
  const progress = useMemo(() => getTodayWidgetProgress(rows), [rows]);
  const colorByCategory = useMemo(() => new Map(categories
    .filter(category => !category.isDeleted && category.userId === ownerId)
    .map(category => [category.id, category.color] as const)), [categories, ownerId]);

  const pendingRef = useRef(new Set<string>());
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDraggedRef = useRef(false);
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

  const todayCard = (
      <section aria-label="Today" className="mosaic-material-control flex h-60 min-h-0 flex-col overflow-hidden rounded-2xl border border-[#333333] bg-surface px-4 py-4"
        onPointerDownCapture={event => {
          pointerStartRef.current = { x: event.clientX, y: event.clientY };
          pointerDraggedRef.current = false;
        }}
        onPointerMoveCapture={event => {
          const start = pointerStartRef.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10)
            pointerDraggedRef.current = true;
        }}
        onPointerCancelCapture={() => { pointerDraggedRef.current = true; pointerStartRef.current = null; }}
        onClickCapture={event => {
          if (!pointerDraggedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          pointerDraggedRef.current = false;
        }}
        onClick={event => {
          // The entire non-control card opens Today; checkbox and label buttons
          // own their individual actions. Do not treat a scroller pan as a tap.
          if (pointerDraggedRef.current ||
            (event.target instanceof Element && event.target.closest('button'))) return;
          onOpenToday();
        }}>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="min-w-0 text-base font-semibold">
            <button type="button" onClick={onOpenToday} aria-label="Open today in Calendar"
              className="inline-flex items-center gap-1.5 rounded text-left text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70">
              Today <ChevronRight size={16} className="text-gray-400" aria-hidden="true" />
            </button>
          </h2>
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
                disabled={pending.has(ownerId + ':' + task.id)} onToggle={onToggle} onOpenToday={onOpenToday} />
            ))}
          </ul>
        )}
      </section>
  );
  const renderCard = (id: WidgetId) => {
    if (id === 'today') return todayCard;
    if (id === 'diary') return <TodayDiaryWidget entries={diaryToday} onOpen={onOpenDiary} />;
    if (id === 'categories') return <HeavyCategoriesWidget categories={heaviestCategories}
      rangeDays={categoryRangeDays} onRangeChange={setCategoryRangeDays} />;
    return <WeeklyProgressWidget progress={progressByPeriod}
      period={progressPeriod} onPeriodChange={setProgressPeriod} />;
  };

  return (
    <div data-testid="widgets-page"
      className="relative min-h-full min-w-0 touch-pan-y px-3 pt-3">
      {layoutError === ownerId && <p role="alert" className="mb-2 text-xs text-red-400">
        Could not save widget layout. Try again.
      </p>}
      {editing && <p className="mb-3 px-1 text-xs text-gray-300">
        Hold a card to edit. Use the top grip to move and the lower-right grip to stretch; release to snap.
      </p>}
      <div className="pb-[max(7rem,env(safe-area-inset-bottom))]">
        <WidgetLayoutGrid items={layout} editing={editing} reducedMotion={reducedMotion}
          onStartEditing={() => onEditingChange(true)}
          onPreview={previewLayout} onCommit={commitLayout}>
          {id => renderCard(id)}
        </WidgetLayoutGrid>
      </div>
    </div>
  );
};

/** Shares the single lazy Widgets bundle; no extra initial Home work or network request. */
/** The header shares the lazy Widgets chunk and leaves the first Home bundle untouched. */
export const WidgetsHeader: React.FC<{
  onBack: () => void;
  editing?: boolean;
  onEdit?: () => void;
  onDone?: () => void;
}> = ({ onBack, editing = false, onEdit = () => {}, onDone = () => {} }) => (
  <div className="flex h-12 items-center justify-between gap-2 px-4">
    <h1 className="text-sm font-semibold text-white">Widgets</h1>
    <div className="flex items-center gap-1">
      {editing ? (
        <button type="button" onClick={onDone} aria-label="Done editing widgets"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500">
          Done
        </button>
      ) : (
        <button type="button" onClick={onEdit} aria-label="Customize widgets"
          className="mosaic-action-icon rounded-lg p-2 text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
          <Pencil size={17} aria-hidden="true" />
        </button>
      )}
      <button type="button" aria-label="Back to Home"
        onClick={() => { if (editing) onDone(); onBack(); }}
        className="mosaic-action-icon rounded-lg p-2 text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  </div>
);
