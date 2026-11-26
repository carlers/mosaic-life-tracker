import React, { lazy, Suspense, useState, useRef, useEffect, useContext } from 'react';
import { DiaryNoteDayContext } from './diaryNoteDayContext';
import { useDiaryEntryActivation } from './useDiaryEntryActivation';
import { BookOpenText, Plus, Images, ChevronDown } from 'lucide-react';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
import { noteDisplayTitle } from '../../../lib/diaryNotes';
import { useDiary } from '../../../hooks/useDiary';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { useSettings } from '../../../hooks/useSettings';
import type { DiaryDocument } from '../../../db/schema';
import { DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, resolveDiaryDayViewHeight } from '../../../lib/preferences';
const DiaryEntrySheet = lazy(() => import('./DiaryEntrySheet').then(m => ({ default: m.DiaryEntrySheet })));
import { diaryMarker } from '../../../lib/diaryMarker';
import { MosaicSelect } from '../../ui/MosaicSelect';
import {
  AUTO_DIARY_MONTH_EMOJI, diaryEntryOrderModeKey, diaryMonthEmojiKey,
  moveDiaryEntry, orderDiaryDayEntries, readDiaryManualOrder,
  resolveDiaryEntryOrderMode, saveDiaryManualOrder,
  type DiaryEntryOrderMode,
} from '../../../lib/diaryDayOrder';

interface DiaryDayCardProps {
  entry?: DiaryDocument;
  title?: string;
  onOpen: () => void;
  onEdit?: () => void;
  expanded?: boolean;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
  dragSourceRef?: React.Ref<HTMLSpanElement>;
}

/** The same compact visual rhythm as a TaskBlock, without pretending to be a task. */
export const DiaryDayCard: React.FC<DiaryDayCardProps> = ({ entry, title, onOpen, onEdit, expanded = false, dragHandleRef, dragSourceRef }) => {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAt = useRef(0);
  const clearPending = () => { if (pending.current) clearTimeout(pending.current); pending.current = null; };
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 || !entry || !onEdit) { clearPending(); onOpen(); return; }
    const now = Date.now();
    if (pending.current && now - lastTapAt.current < 280) {
      clearPending(); lastTapAt.current = 0; onEdit(); return;
    }
    clearPending(); lastTapAt.current = now;
    pending.current = setTimeout(() => { pending.current = null; onOpen(); }, 280);
  };
  return (
  <button ref={entry ? dragHandleRef : undefined} type="button" onClick={handleClick}
    onPointerCancel={clearPending} onDragStart={clearPending} data-testid="diary-day-card"
    aria-label={entry ? (onEdit ? 'Read diary entry, double tap to edit' : 'Read diary entry') : 'Add diary entry'}
    className="relative flex min-w-0 w-full items-start gap-3 rounded-lg py-2 pl-0 pr-2 text-left text-white outline-offset-2 transition-colors hover:bg-surfaceHighlight focus-visible:outline focus-visible:outline-2">
    {dragSourceRef && <span ref={dragSourceRef} data-diary-dnd-source="true" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} />}
    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400" aria-hidden="true">
      {entry ? <BookOpenText size={19}/> : <Plus size={18}/>}
    </span>
    <span className="min-w-0 flex-1">
      <span className={expanded ? 'block whitespace-pre-wrap break-words text-base' : 'block overflow-hidden whitespace-nowrap text-base'}>
        {title || entry?.content?.trim() || (entry ? 'Diary entry' : 'Add diary entry')}
      </span>
      {expanded && entry?.emoji && <span aria-hidden="true" className="mt-1 inline-block text-lg">{diaryMarker(entry)}</span>}
      {expanded && entry?.photos && parseDiaryPhotos(entry.photos).length > 0 && (
        <span className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Images size={14}/> {parseDiaryPhotos(entry.photos).length} photos</span>
      )}
    </span>
  </button>
  );
};

/** Session-only state survives the short settling-frame remount after bulk drag.
 * The date/mode keys prevent sharing between different days or settings. */
export interface DiaryDayUiSession {
  date: string;
  expandedMode: boolean;
  expandedDefault: boolean;
  expandedIds: readonly string[];
  visibleLimit: number;
}

/** Ordering and expansion are independent; owner order and chosen marker persist
 * in account-scoped settings while friend's supplied entries remain read-only. */
export interface DiaryDayGroupProps {
  date: string;
  entries: readonly DiaryDocument[];
  onOpen: (entry: DiaryDocument) => void;
  getEntryTitle?: (entry: DiaryDocument) => string;
  onNew?: () => void;
  onEdit?: (entry: DiaryDocument) => void;
  expanded?: boolean;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
  dragSourceRef?: React.Ref<HTMLSpanElement>;
  sessionState?: DiaryDayUiSession | null;
  onSessionStateChange?: (value: DiaryDayUiSession) => void;
  orderMode?: DiaryEntryOrderMode;
  manualOrder?: readonly string[];
  onOrderModeChange?: (mode: DiaryEntryOrderMode) => Promise<void>;
  onReorder?: (entryIds: readonly string[]) => Promise<void>;
  monthEmojiEntryId?: string;
  onMonthEmojiChange?: (entryId: string) => Promise<void>;
}

const OWNER_DIARY_ORDER_OPTIONS = [
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'manual', label: 'Manual' },
] as const;
const FRIEND_DIARY_ORDER_OPTIONS = OWNER_DIARY_ORDER_OPTIONS.slice(0, 2);

interface DiaryDragPointer {
  id: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  startCenterY: number;
  /** Original, untransformed centers; sibling transforms must not affect hit testing. */
  centers: readonly { id: string; y: number }[];
  shiftDistance: number;
  targetId: string;
  visualTargetId: string;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}
interface DiaryDragPreview { id: string; targetId: string; deltaY: number; shiftDistance: number }
const DIARY_ENTRY_LONG_PRESS_MS = 450;
const DIARY_ENTRY_SCROLL_CANCEL_PX = 10;

/** The entire owner entry is the long-press drag surface, not a separate grip.
 * Native scrolling and child button clicks remain available until activation. */
export const DiaryDayGroup: React.FC<DiaryDayGroupProps> = ({
  date, entries, onOpen, getEntryTitle, onNew, onEdit, expanded = false, dragHandleRef, dragSourceRef,
  sessionState, onSessionStateChange, orderMode, manualOrder = [], onOrderModeChange, onReorder,
  monthEmojiEntryId = AUTO_DIARY_MONTH_EMOJI, onMonthEmojiChange,
}) => {
  const dayNotes = useContext(DiaryNoteDayContext);
  const entryActivation = useDiaryEntryActivation(onOpen, onEdit);
  const independentCount = dayNotes?.layout === 'distributed'
    ? dayNotes.totalEntries - entries.length : 0;
  const hasLayoutControl = Boolean(dayNotes && dayNotes.savedCount > 0);
  const showGroupHeading = entries.length > 1 || hasLayoutControl ||
    Boolean(dayNotes && entries.length === 1 && onReorder);
  const [localMode, setLocalMode] = useState<DiaryEntryOrderMode>('oldest');
  const [modeOverride, setModeOverride] = useState<{
    value: DiaryEntryOrderMode; baseline: DiaryEntryOrderMode;
  } | null>(null);
  const [manualOverride, setManualOverride] = useState<{
    ids: readonly string[]; baseline: readonly string[];
  } | null>(null);
  const initialSession = sessionState?.date === date &&
    sessionState.expandedMode === expanded ? sessionState : null;
  const [visibleLimit, setVisibleLimit] = useState(() => initialSession?.visibleLimit ?? 30);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialSession?.expandedIds ?? []));
  const [expandedDefault, setExpandedDefault] = useState(
    () => initialSession?.expandedDefault ?? expanded);
  // Persist UI-only changes above the keyed settling frame, without reading
  // refs during render or writing to synchronized settings/Appwrite.
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [drag, setDrag] = useState<DiaryDragPreview | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState<{id: string; targetId: string} | null>(null);
  const pointerRef = useRef<DiaryDragPointer | null>(null);
  const suppressDragClickRef = useRef<{ id: string } | null>(null);
  const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Optimistic values apply only while their original persisted baseline is
  // unchanged. When settings sync catches up, the props take precedence
  // without extra effect-driven state updates or overriding later device edits.
  const persistedMode = orderMode ?? localMode;
  const mode = modeOverride && persistedMode === modeOverride.baseline
    ? modeOverride.value : persistedMode;
  const sameManualBaseline = manualOverride &&
    manualOverride.baseline.length === manualOrder.length &&
    manualOverride.baseline.every((id, i) => id === manualOrder[i]);
  const effectiveManualOrder = sameManualBaseline ? manualOverride.ids : manualOrder;
  const sorted = orderDiaryDayEntries(entries, mode, effectiveManualOrder);
  const shownEntries = sorted.slice(0, visibleLimit);
  const dragSourceIndex = drag ? shownEntries.findIndex(entry => entry.id === drag.id) : -1;
  const dragTargetIndex = drag ? shownEntries.findIndex(entry => entry.id === drag.targetId) : -1;
  const reduceReflowMotion = typeof document !== 'undefined' &&
    (document.documentElement.dataset.reduceMotion === 'true' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  useEffect(() => () => {
    if (pointerRef.current?.timer) clearTimeout(pointerRef.current.timer);
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
  }, []);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !onReorder) return;
    // The touch surface retains native pan-y scrolling before the long press.
    // Once a diary entry is carried, prevent native scrolling in a non-passive
    // listener so touch browsers do not steal the active pointer.
    const onTouchMove = (event: TouchEvent) => {
      if (pointerRef.current?.active && pointerRef.current.pointerType === 'touch' &&
          event.touches.length === 1 && event.cancelable) event.preventDefault();
    };
    list.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => list.removeEventListener('touchmove', onTouchMove);
  }, [onReorder, shownEntries.length]);

  const shown = (id: string) => expandedDefault !== expandedIds.has(id);
  const persistUiState = (patch: Partial<Pick<DiaryDayUiSession,
    'expandedDefault' | 'expandedIds' | 'visibleLimit'>>) => {
    onSessionStateChange?.({
      date, expandedMode: expanded, expandedDefault,
      expandedIds: [...expandedIds], visibleLimit, ...patch,
    });
  };
  const setAll = (next: boolean) => {
    setExpandedDefault(next);
    setExpandedIds(new Set());
    persistUiState({ expandedDefault: next, expandedIds: [] });
  };
  const toggle = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedIds(next);
    persistUiState({ expandedIds: [...next] });
  };
  const chooseMode = (next: DiaryEntryOrderMode) => {
    if (busy || next === mode) return;
    setError('');
    if (!onOrderModeChange) { setLocalMode(next); return; }
    setModeOverride({ value: next, baseline: persistedMode });
    void onOrderModeChange(next).catch(cause => {
      setModeOverride(null);
      setError(cause instanceof Error ? cause.message : 'Unable to save diary order');
    });
  };
  const commitReorder = async (id: string, targetId: string) => {
    if (!onReorder || busy || id === targetId) return;
    const next = moveDiaryEntry(sorted.map(entry => entry.id), id, targetId);
    if (next.every((value, index) => value === sorted[index]?.id)) return;
    setManualOverride({ ids: next, baseline: manualOrder });
    setModeOverride({ value: 'manual', baseline: persistedMode });
    setError(''); setBusy(true);
    try {
      await onReorder(next);
      setLiveMessage('Diary entry moved. Manual order selected.');
    } catch (cause) {
      setManualOverride(null); setModeOverride(null);
      setError(cause instanceof Error ? cause.message : 'Unable to save diary order');
    } finally { setBusy(false); }
  };
  const clearPointer = () => {
    const gesture = pointerRef.current;
    if (gesture?.timer) clearTimeout(gesture.timer);
    if (gesture?.active) {
      // Start the suppression expiry at release/cancel, NOT pickup. A held
      // finger can remain down for several seconds; it must never open
      // the diary entry when finally released.
      suppressDragClickRef.current = { id: gesture.id };
      if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = setTimeout(() => {
        suppressDragClickRef.current = null;
        suppressClickTimerRef.current = null;
      }, 650);
    }
    pointerRef.current = null; setDrag(null);
    dayNotes?.onDragEnd();
  };
  const onRowPointerDown = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!onReorder || busy || event.button !== 0 || event.isPrimary === false ||
        pointerRef.current) return;
    // An unrelated long-press must never suppress the next ordinary tap.
    suppressDragClickRef.current = null;
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = null;
    const rowElement = event.currentTarget;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-diary-reorder-id]') ?? []);
    const bounds = rows.map(row => ({ id: row.dataset.diaryReorderId ?? '',
      rect: row.getBoundingClientRect() }));
    const sourceIndex = bounds.findIndex(row => row.id === id);
    if (sourceIndex < 0) return;
    const source = bounds[sourceIndex].rect;
    const following = bounds[sourceIndex + 1]?.rect;
    const preceding = bounds[sourceIndex - 1]?.rect;
    const gap = following ? following.top - source.bottom :
      preceding ? source.top - preceding.bottom : 0;
    const gesture: DiaryDragPointer = {
      id, pointerId: event.pointerId, pointerType: event.pointerType,
      startX: event.clientX, startY: event.clientY,
      startCenterY: source.top + source.height / 2,
      centers: bounds.map(row => ({ id: row.id, y: row.rect.top + row.rect.height / 2 })),
      shiftDistance: source.height + Math.max(0, gap),
      targetId: id, visualTargetId: id, active: false, timer: null,
    };
    pointerRef.current = gesture;
    gesture.timer = setTimeout(() => {
      if (pointerRef.current !== gesture) return;
      gesture.timer = null; gesture.active = true;
      // Capture only AFTER the hold. Capturing on pointerdown would interfere
      // with normal taps, scroll and swipes on child controls.
      try { rowElement.setPointerCapture?.(gesture.pointerId); }
      catch { /* Pointer already released or native scroll canceled */ }
      suppressDragClickRef.current = { id };
      setDrag({ id, targetId: id, deltaY: 0, shiftDistance: gesture.shiftDistance });
      dayNotes?.onDragStart(id, rowElement.getBoundingClientRect(),
        gesture.startX, gesture.startY, 'group');
    }, DIARY_ENTRY_LONG_PRESS_MS);
  };
  const onRowPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.active) {
      if (Math.abs(event.clientX - gesture.startX) > DIARY_ENTRY_SCROLL_CANCEL_PX ||
          Math.abs(event.clientY - gesture.startY) > DIARY_ENTRY_SCROLL_CANCEL_PX) {
        clearPointer();
      }
      return;
    }
    event.stopPropagation();
    const deltaY = event.clientY - gesture.startY;
    const movingCenter = gesture.startCenterY + deltaY;
    // Hit-test against the original layout, not animated sibling transforms.
    // Otherwise the target oscillates as soon as another entry yields space.
    let closest = gesture.id;
    let boundary = gesture.startCenterY;
    for (const row of gesture.centers) {
      if (row.id === gesture.id) continue;
      if ((deltaY > 0 && row.y > boundary && row.y <= movingCenter) ||
          (deltaY < 0 && row.y < boundary && row.y >= movingCenter)) {
        boundary = row.y;
        closest = row.id;
      }
    }
    gesture.targetId = closest;
    const outside = dayNotes?.onDragMove(gesture.id, event.clientX, event.clientY, gesture.shiftDistance);
    const targetId = outside ? gesture.id : closest;
    // The carried entry follows the finger in the portal. Rerender the group
    // only when a sibling actually changes its reorder target; on a long
    // hold, hundreds of pointer events now cause zero React renders.
    if (!dayNotes) {
      // Standalone Diary (no owner task/Diary portal) retains the original
      // in-list drag presentation and its keyboard/pointer behavior.
      setDrag({ id: gesture.id, targetId, deltaY, shiftDistance: gesture.shiftDistance });
    } else if (gesture.visualTargetId !== targetId) {
      gesture.visualTargetId = targetId;
      setDrag({ id: gesture.id, targetId, deltaY: 0, shiftDistance: gesture.shiftDistance });
    }
  };
  const onRowPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = pointerRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.active) event.stopPropagation();
    const extracted = gesture.active && dayNotes?.onDragRelease(gesture.id, event.clientX, event.clientY);
    const groupBounds = listRef.current?.getBoundingClientRect();
    const releasedInsideGroup = groupBounds &&
      event.clientY >= groupBounds.top && event.clientY <= groupBounds.bottom &&
      event.clientX >= groupBounds.left && event.clientX <= groupBounds.right;
    clearPointer();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (gesture.active && !extracted && (!dayNotes || releasedInsideGroup) && gesture.id !== gesture.targetId)
      void commitReorder(gesture.id, gesture.targetId);
  };
  const onRowClickCapture = (event: React.MouseEvent<HTMLDivElement>, id: string) => {
    const suppression = suppressDragClickRef.current;
    if (event.detail === 0 || !suppression || suppression.id !== id) return;
    suppressDragClickRef.current = null;
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };
  const onRowKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!onReorder || busy) return;
    if (event.key === 'Escape' && keyboardDrag?.id === id) {
      event.preventDefault(); event.stopPropagation(); setKeyboardDrag(null); return;
    }
    // Enter still reads the entry; Space deliberately starts/finishes a
    // keyboard reorder without a visible grip.
    if (event.key === ' ' || (event.key === 'Enter' && keyboardDrag?.id === id)) {
      event.preventDefault(); event.stopPropagation();
      if (keyboardDrag?.id === id) {
        setKeyboardDrag(null);
        if (keyboardDrag.targetId !== id) void commitReorder(id, keyboardDrag.targetId);
      } else setKeyboardDrag({ id, targetId: id });
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && keyboardDrag?.id === id) {
      event.preventDefault(); event.stopPropagation();
      const index = shownEntries.findIndex(entry => entry.id === keyboardDrag.targetId);
      const next = Math.max(0, Math.min(shownEntries.length - 1,
        index + (event.key === 'ArrowDown' ? 1 : -1)));
      setKeyboardDrag({ id, targetId: shownEntries[next]?.id || id });
    }
  };

  if (!showGroupHeading && sorted.length === 0) return onNew
    ? <DiaryDayCard onOpen={onNew} expanded={expanded} /> : null;
  if (!showGroupHeading && sorted.length === 1) return (
    <div className="min-w-0" data-testid="diary-day-group">
      <DiaryDayCard entry={sorted[0]} title={getEntryTitle?.(sorted[0])} onOpen={() => onOpen(sorted[0])}
        onEdit={onEdit ? () => onEdit(sorted[0]) : undefined}
        expanded={expanded} dragHandleRef={dragHandleRef} dragSourceRef={dragSourceRef}/>
      {onNew && <button type="button" onClick={onNew}
        className="my-1 flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-surfaceHighlight focus-visible:outline"
        aria-label="New diary entry on this day"><Plus size={14}/> New entry</button>}
    </div>
  );
  const allExpanded = sorted.every(entry => shown(entry.id));
  const emojiCandidates = sorted.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => Boolean(diaryMarker(entry)));
  const emojiSelection = emojiCandidates.some(({entry}) => entry.id === monthEmojiEntryId)
    ? monthEmojiEntryId : AUTO_DIARY_MONTH_EMOJI;
  const emojiOptions = [
    { value: AUTO_DIARY_MONTH_EMOJI, label: 'Auto · first emoji' },
    ...emojiCandidates.map(({ entry, index }) => ({
      value: entry.id,
      label: `${diaryMarker(entry)} · Entry ${index + 1}`,
      description: new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    })),
  ];
  return (
    <section className="min-w-0 rounded-lg bg-surfaceHighlight p-2" data-testid="diary-day-group" data-diary-drag-group="true"
      aria-label={`Diary, ${sorted.length} entries on ${date}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" ref={dragHandleRef} data-diary-drag-heading="true"
          aria-label={`Diary group, ${sorted.length} entries`}
          className="relative flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-white focus-visible:outline">
          {dragSourceRef && <span ref={dragSourceRef} data-diary-dnd-source="true" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} />}
          <BookOpenText size={16}/> {sorted.length} grouped
          {independentCount > 0 && <span className="ml-1 text-xs font-normal text-gray-400">· {independentCount} distributed</span>}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {dayNotes && <button type="button"
            aria-label={dayNotes.layout === 'grouped' ? 'Restore diary entry positions' : 'Group all diary entries'}
            disabled={!hasLayoutControl}
            onClick={dayNotes.toggleLayout}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-surface disabled:opacity-40">
            {dayNotes.layout === 'grouped' ? 'Restore positions' : 'Group all'}
          </button>}
          <MosaicSelect variant="compact" label="Diary entry order" value={mode}
            onChange={value => chooseMode(resolveDiaryEntryOrderMode(value))}
            options={onReorder ? OWNER_DIARY_ORDER_OPTIONS : FRIEND_DIARY_ORDER_OPTIONS}
            disabled={busy}/>
          <button type="button" onClick={() => setAll(!allExpanded)}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-surfaceHighlight focus-visible:outline">
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          {onNew && <button type="button" onClick={onNew}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-white hover:bg-surfaceHighlight focus-visible:outline">
            <Plus size={15}/> New entry
          </button>}
        </div>
      </div>
      {onMonthEmojiChange && emojiCandidates.length > 0 &&
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-xs text-gray-400">Month grid emoji</span>
          <MosaicSelect variant="compact" label="Month grid emoji" value={emojiSelection}
            options={emojiOptions} disabled={busy}
            onChange={id => {
              setError('');
              void onMonthEmojiChange(id).catch(cause =>
                setError(cause instanceof Error ? cause.message : 'Could not save month emoji'));
            }}/>
        </div>}
      <div ref={listRef} className="relative space-y-1" role={onReorder ? 'list' : undefined}>
        {shownEntries.map((entry, index) => {
          const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const moving = drag?.id === entry.id;
          // A single full-height gap moves between siblings during hover.
          // Each sibling glides exactly one source-card height (+ row spacing);
          // the carried card itself has no easing and stays under the pointer.
          const shift = drag && !moving && dragSourceIndex >= 0 && dragTargetIndex >= 0
            ? dragSourceIndex < dragTargetIndex && index > dragSourceIndex && index <= dragTargetIndex
              ? -drag.shiftDistance
              : dragSourceIndex > dragTargetIndex && index >= dragTargetIndex && index < dragSourceIndex
                ? drag.shiftDistance : 0
            : 0;
          const target = !drag && keyboardDrag?.targetId === entry.id &&
            keyboardDrag?.id !== entry.id;
          return <div key={entry.id} data-diary-reorder-id={entry.id}
            role={onReorder ? 'listitem' : undefined}
            className={`min-w-0 rounded-lg bg-surface p-2 ${onReorder ? 'select-none' : ''}`}
            onPointerDown={event => {
              entryActivation.rememberPointer(event.pointerType);
              onRowPointerDown(event, entry.id);
            }}
            onDoubleClick={onEdit ? () => entryActivation.doubleClick(entry) : undefined}
            onPointerMove={onRowPointerMove}
            onPointerUp={onRowPointerUp}
            onPointerCancel={clearPointer}
            onLostPointerCapture={clearPointer}
            onPointerLeave={event => {
              if (!pointerRef.current?.active && event.pointerType === 'mouse') clearPointer();
            }}
            onClickCapture={event => onRowClickCapture(event, entry.id)}
            onContextMenu={event => {
              if (pointerRef.current?.active && pointerRef.current.id === entry.id) event.preventDefault();
            }}
            onDragStart={event => { if (onReorder) event.preventDefault(); }}
            style={{
              // When an entry leaves the bulk group, it must relinquish its
              // list height immediately. A retained pointer-captured node
              // stays mounted but out of flow until the destination settles.
              position: dayNotes?.floatingEntryId === entry.id && dayNotes.floatingExternal
                ? 'absolute' : 'relative',
              width: dayNotes?.floatingEntryId === entry.id && dayNotes.floatingExternal
                ? '100%' : undefined,
              insetInline: dayNotes?.floatingEntryId === entry.id && dayNotes.floatingExternal
                ? 0 : undefined,
              touchAction: onReorder ? 'pan-y' : undefined,
              cursor: onReorder ? (moving ? 'grabbing' : 'grab') : undefined,
              // In mixed owner Day View, the carried card moves only in the
              // portal. Standalone Diary keeps its original in-list drag.
              zIndex: moving && !dayNotes ? 3 : undefined,
              opacity: dayNotes?.floatingEntryId === entry.id ? 0 : undefined,
              transform: moving && !dayNotes ? `translate3d(0, ${drag.deltaY}px, 0)` :
                !moving && shift ? `translate3d(0, ${shift}px, 0)` : undefined,
              transition: moving || reduceReflowMotion ? 'none' :
                drag ? 'transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined,
              boxShadow: moving ? '0 8px 20px rgba(0,0,0,0.22)' :
                target ? 'inset 0 2px 0 var(--mosaic-accent)' : undefined,
              willChange: moving || shift ? 'transform' : undefined,
            }}>
            <div className="flex min-w-0 items-start gap-2">
              <button type="button" onClick={() => toggle(entry.id)}
                aria-label={shown(entry.id) ? 'Collapse entry' : 'Expand entry'}
                aria-expanded={shown(entry.id)}
                className="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 focus-visible:outline">
                <ChevronDown size={16} className={shown(entry.id) ? '' : '-rotate-90'}/>
              </button>
              <button type="button" onClick={event => entryActivation.activate(entry, event.detail)}
                onKeyDown={event => onRowKeyDown(event, entry.id)}
                onBlur={() => { if (keyboardDrag?.id === entry.id) setKeyboardDrag(null); }}
                aria-keyshortcuts={onReorder ? 'Space ArrowUp ArrowDown Escape' : undefined}
                title={onReorder ? 'Long press anywhere on this entry to reorder; keyboard: Space, arrows, Space' : undefined}
                className="min-w-0 flex-1 rounded-md text-left text-white focus-visible:outline"
                aria-label={`Read diary entry from ${time}`}>
                <span className="block truncate text-sm font-medium">
                  {entry.emoji ? `${entry.emoji} ` : ''}{getEntryTitle?.(entry) || entry.content?.trim().split('\n')[0] || 'Diary entry'}
                </span>
                <span className="block text-xs text-gray-400">
                  {time}{onNew && <> · {entry.visibility === 'followers' ? 'Friends' : entry.visibility === 'public' ? 'Public' : 'Private'}</>}
                </span>
              </button>
              {onEdit && <button type="button" onClick={() => onEdit(entry)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-surfaceHighlight focus-visible:outline"
                aria-label="Edit selected diary entry">Edit</button>}
            </div>
            {shown(entry.id) && <p className="mt-2 whitespace-pre-wrap break-words px-2 text-sm text-white">
              {(entry.content || '').slice(0, 1200)}
              {(entry.content || '').length > 1200 ? '…' : ''}
            </p>}
          </div>;
        })}
      </div>
      <div className="sr-only" aria-live="polite">{liveMessage}</div>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {sorted.length > visibleLimit && (
        <button type="button" className="mt-2 w-full rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-surface focus-visible:outline"
          onClick={() => {
            const next = visibleLimit + 30;
            setVisibleLimit(next);
            persistUiState({ visibleLimit: next });
          }}
          aria-label="Show more diary entries">
          Show more entries ({Math.min(sorted.length - visibleLimit, 30)} of {sorted.length - visibleLimit} remaining)
        </button>
      )}
    </section>
  );
};

/** Opt-in owner Day View group, with one editor per immutable diary entry ID. */
export const DiaryDayPreview: React.FC<{
  date: string;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
  dragSourceRef?: React.Ref<HTMLSpanElement>;
  sessionState?: DiaryDayUiSession | null;
  onSessionStateChange?: (value: DiaryDayUiSession) => void;
  entryOverride?: DiaryDocument;
}> = ({ date, dragHandleRef, dragSourceRef, sessionState, onSessionStateChange, entryOverride }) => {
  const { getEntriesByDate, createEntry, updateEntry, deleteEntryById } = useDiary(entryOverride === undefined);
  const { getSetting, setSetting } = useSettings();
  const [selection, setSelection] = useState<{ entryId: string | null; mode: 'read' | 'edit' } | null>(null);
  const dayNotes = useContext(DiaryNoteDayContext);
  const allEntries = entryOverride ? [entryOverride] : getEntriesByDate(date);
  const entries = dayNotes ? allEntries.filter(entry => dayNotes.groupedEntryIds.has(entry.id)) : allEntries;
  const picked = selection?.entryId ? entries.find(entry => entry.id === selection.entryId) : undefined;
  const { value: diarySession, onExitComplete: clearDiarySession } = useRetainedSheetValue(
    selection ? { id: `${date}:${selection.entryId || 'new'}:${selection.mode}`, date,
      mode: selection.mode, entry: picked, entryId: selection.entryId } : null,
    selection !== null
  );
  const expanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  const entryOrderMode = resolveDiaryEntryOrderMode(getSetting(diaryEntryOrderModeKey(date), 'oldest'));
  const savedManualOrder = readDiaryManualOrder(date, key => getSetting(key));
  const savedMonthEmoji = getSetting(diaryMonthEmojiKey(date), AUTO_DIARY_MONTH_EMOJI);
  return (
    <>
      <div className="my-2 min-w-0" data-diary-drag-visual="true">
        <DiaryDayGroup key={`${date}:${expanded}`} date={date} entries={entries}
          getEntryTitle={entry => entryOverride
            ? entry.content?.trim().split('\n')[0] || 'Diary entry'
            : noteDisplayTitle(entry, key => getSetting(key))}
          onOpen={entry => setSelection({ entryId: entry.id, mode: 'read' })}
          onEdit={entry => setSelection({ entryId: entry.id, mode: 'edit' })}
          onNew={() => setSelection({ entryId: null, mode: 'edit' })}
          expanded={expanded} dragHandleRef={dragHandleRef} dragSourceRef={dragSourceRef}
          sessionState={sessionState} onSessionStateChange={onSessionStateChange} orderMode={entryOrderMode} manualOrder={savedManualOrder}
          onOrderModeChange={mode => setSetting(diaryEntryOrderModeKey(date), mode)}
          onReorder={async ids => {
            await saveDiaryManualOrder(date, ids, key => getSetting(key), setSetting);
            await setSetting(diaryEntryOrderModeKey(date), 'manual');
          }}
          monthEmojiEntryId={typeof savedMonthEmoji === 'string' ? savedMonthEmoji : AUTO_DIARY_MONTH_EMOJI}
          onMonthEmojiChange={id => setSetting(diaryMonthEmojiKey(date), id)}/>
      </div>
      {diarySession && <Suspense fallback={null}><DiaryEntrySheet key={diarySession.id}
        isOpen={selection !== null} onExitComplete={clearDiarySession}
        date={diarySession.date} entry={diarySession.entry} author="Me"
        onSave={async (day, body, visibility, emoji, photos, retryId, titleOnly) => {
          const id = diarySession.entryId || retryId;
          if (id) {
            await updateEntry(id, day, body, visibility, emoji, photos, titleOnly);
          } else return createEntry(day, body, visibility, emoji, photos, titleOnly);
        }}
        onDelete={diarySession.entryId ? async () => deleteEntryById(diarySession.entryId!) : undefined}
        initialEditing={diarySession.mode === 'edit'}
        onClose={() => setSelection(null)} /></Suspense>}
    </>
  );
};
