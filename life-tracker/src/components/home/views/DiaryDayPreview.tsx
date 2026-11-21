import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { BookOpenText, Plus, Images, ChevronDown, GripVertical } from 'lucide-react';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
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
  onOpen: () => void;
  onEdit?: () => void;
  expanded?: boolean;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
}

/** The same compact visual rhythm as a TaskBlock, without pretending to be a task. */
export const DiaryDayCard: React.FC<DiaryDayCardProps> = ({ entry, onOpen, onEdit, expanded = false, dragHandleRef }) => {
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
    className="flex min-w-0 w-full items-start gap-3 rounded-lg py-2 pl-0 pr-2 text-left text-white outline-offset-2 transition-colors hover:bg-surfaceHighlight focus-visible:outline focus-visible:outline-2">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400" aria-hidden="true">
      {entry ? <BookOpenText size={19}/> : <Plus size={18}/>}
    </span>
    <span className="min-w-0 flex-1">
      <span className={expanded ? 'block whitespace-pre-wrap break-words text-base' : 'block overflow-hidden whitespace-nowrap text-base'}>
        {entry?.content?.trim() || (entry ? 'Diary entry' : 'Add diary entry')}
      </span>
      {expanded && entry?.emoji && <span aria-hidden="true" className="mt-1 inline-block text-lg">{diaryMarker(entry)}</span>}
      {expanded && entry?.photos && parseDiaryPhotos(entry.photos).length > 0 && (
        <span className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Images size={14}/> {parseDiaryPhotos(entry.photos).length} photos</span>
      )}
    </span>
  </button>
  );
};

/** Ordering and expansion are independent; owner order and chosen marker persist
 * in account-scoped settings while friend's supplied entries remain read-only. */
export interface DiaryDayGroupProps {
  date: string;
  entries: readonly DiaryDocument[];
  onOpen: (entry: DiaryDocument) => void;
  onNew?: () => void;
  onEdit?: (entry: DiaryDocument) => void;
  expanded?: boolean;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
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
  startY: number;
  targetId: string;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}
interface DiaryDragPreview { id: string; targetId: string; deltaY: number }

/** Pointer capture is scoped to each entry's grip, separate from the outer
 * Timeline diary-group handle and the Calendar's swipe gesture owner. */
export const DiaryDayGroup: React.FC<DiaryDayGroupProps> = ({
  date, entries, onOpen, onNew, onEdit, expanded = false, dragHandleRef,
  orderMode, manualOrder = [], onOrderModeChange, onReorder,
  monthEmojiEntryId = AUTO_DIARY_MONTH_EMOJI, onMonthEmojiChange,
}) => {
  const [localMode, setLocalMode] = useState<DiaryEntryOrderMode>('oldest');
  const [modeOverride, setModeOverride] = useState<DiaryEntryOrderMode | null>(null);
  const [manualOverride, setManualOverride] = useState<readonly string[] | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [expandedDefault, setExpandedDefault] = useState(expanded);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [drag, setDrag] = useState<DiaryDragPreview | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState<{id: string; targetId: string} | null>(null);
  const pointerRef = useRef<DiaryDragPointer | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const mode = modeOverride ?? orderMode ?? localMode;
  const effectiveManualOrder = manualOverride ?? manualOrder;
  const sorted = orderDiaryDayEntries(entries, mode, effectiveManualOrder);
  const shownEntries = sorted.slice(0, visibleLimit);

  useEffect(() => {
    if (modeOverride !== null && orderMode === modeOverride) setModeOverride(null);
  }, [modeOverride, orderMode]);
  useEffect(() => {
    if (manualOverride && manualOverride.length === manualOrder.length &&
      manualOverride.every((id, i) => id === manualOrder[i])) setManualOverride(null);
  }, [manualOverride, manualOrder]);
  useEffect(() => () => {
    if (pointerRef.current?.timer) clearTimeout(pointerRef.current.timer);
  }, []);

  const shown = (id: string) => expandedDefault !== expandedIds.has(id);
  const setAll = (next: boolean) => { setExpandedDefault(next); setExpandedIds(new Set()); };
  const toggle = (id: string) => setExpandedIds(old => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const chooseMode = (next: DiaryEntryOrderMode) => {
    if (busy || next === mode) return;
    setError('');
    if (!onOrderModeChange) { setLocalMode(next); return; }
    setModeOverride(next);
    void onOrderModeChange(next).catch(cause => {
      setModeOverride(null);
      setError(cause instanceof Error ? cause.message : 'Unable to save diary order');
    });
  };
  const commitReorder = async (id: string, targetId: string) => {
    if (!onReorder || busy || id === targetId) return;
    const next = moveDiaryEntry(sorted.map(entry => entry.id), id, targetId);
    if (next.every((value, index) => value === sorted[index]?.id)) return;
    setManualOverride(next); setModeOverride('manual'); setError(''); setBusy(true);
    try {
      await onReorder(next);
      setLiveMessage('Diary entry moved. Manual order selected.');
    } catch (cause) {
      setManualOverride(null); setModeOverride(null);
      setError(cause instanceof Error ? cause.message : 'Unable to save diary order');
    } finally { setBusy(false); }
  };
  const clearPointer = () => {
    if (pointerRef.current?.timer) clearTimeout(pointerRef.current.timer);
    pointerRef.current = null; setDrag(null);
  };
  const onGripPointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!onReorder || busy || event.button !== 0 || pointerRef.current) return;
    event.stopPropagation();
    const gesture: DiaryDragPointer = {
      id, pointerId: event.pointerId, startY: event.clientY,
      targetId: id, active: false, timer: null,
    };
    pointerRef.current = gesture;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.timer = setTimeout(() => {
      if (pointerRef.current !== gesture) return;
      gesture.timer = null; gesture.active = true;
      setDrag({ id, targetId: id, deltaY: 0 });
    }, 240);
  };
  const onGripPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = pointerRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.active) {
      if (Math.abs(event.clientY - gesture.startY) > 10) clearPointer();
      return;
    }
    event.stopPropagation();
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-diary-reorder-id]') ?? []);
    let closest = gesture.id, distance = Infinity;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const delta = Math.abs(event.clientY - rect.top - rect.height / 2);
      if (delta < distance) { distance = delta; closest = row.dataset.diaryReorderId || gesture.id; }
    }
    gesture.targetId = closest;
    setDrag({ id: gesture.id, targetId: closest, deltaY: event.clientY - gesture.startY });
  };
  const onGripPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = pointerRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.stopPropagation();
    clearPointer();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (gesture.active && gesture.id !== gesture.targetId)
      void commitReorder(gesture.id, gesture.targetId);
  };
  const onGripKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!onReorder || busy) return;
    if (event.key === 'Escape' && keyboardDrag?.id === id) {
      event.preventDefault(); event.stopPropagation(); setKeyboardDrag(null); return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
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

  if (sorted.length === 0) return onNew
    ? <DiaryDayCard onOpen={onNew} expanded={expanded} /> : null;
  if (sorted.length === 1) return (
    <div className="min-w-0" data-testid="diary-day-group">
      <DiaryDayCard entry={sorted[0]} onOpen={() => onOpen(sorted[0])}
        onEdit={onEdit ? () => onEdit(sorted[0]) : undefined}
        expanded={expanded} dragHandleRef={dragHandleRef}/>
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
    <section className="min-w-0 rounded-lg bg-surfaceHighlight p-2" data-testid="diary-day-group"
      aria-label={`Diary, ${sorted.length} entries on ${date}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" ref={dragHandleRef}
          aria-label={`Diary group, ${sorted.length} entries`}
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-white focus-visible:outline">
          <BookOpenText size={16}/> {sorted.length} diary entries
        </button>
        <div className="flex flex-wrap items-center gap-2">
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
      <div ref={listRef} className="space-y-1" role={onReorder ? 'list' : undefined}>
        {shownEntries.map((entry, index) => {
          const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const moving = drag?.id === entry.id;
          const target = drag?.targetId === entry.id && drag?.id !== entry.id ||
            keyboardDrag?.targetId === entry.id && keyboardDrag?.id !== entry.id;
          return <div key={entry.id} data-diary-reorder-id={entry.id}
            role={onReorder ? 'listitem' : undefined}
            className="min-w-0 rounded-lg bg-surface p-2"
            style={{
              position: 'relative',
              zIndex: moving ? 3 : undefined,
              transform: moving ? `translate3d(0, ${drag.deltaY}px, 0)` : undefined,
              boxShadow: moving ? '0 8px 20px rgba(0,0,0,0.22)' :
                target ? 'inset 0 2px 0 var(--mosaic-accent)' : undefined,
              willChange: moving ? 'transform' : undefined,
            }}>
            <div className="flex min-w-0 items-start gap-2">
              {onReorder && <button type="button"
                aria-label={`Reorder diary entry ${index + 1} of ${sorted.length}`}
                aria-pressed={moving || keyboardDrag?.id === entry.id}
                title="Long press and drag to reorder; keyboard: Space, arrows, Space"
                disabled={busy}
                className="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent)]"
                style={{ touchAction: 'none', cursor: moving ? 'grabbing' : 'grab' }}
                onPointerDown={event => onGripPointerDown(event, entry.id)}
                onPointerMove={onGripPointerMove}
                onPointerUp={onGripPointerUp}
                onPointerCancel={clearPointer}
                onLostPointerCapture={clearPointer}
                onKeyDown={event => onGripKeyDown(event, entry.id)}
                onBlur={() => { if (keyboardDrag?.id === entry.id) setKeyboardDrag(null); }}
                onClick={event => event.preventDefault()}>
                <GripVertical size={16}/>
              </button>}
              <button type="button" onClick={() => toggle(entry.id)}
                aria-label={shown(entry.id) ? 'Collapse entry' : 'Expand entry'}
                aria-expanded={shown(entry.id)}
                className="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 focus-visible:outline">
                <ChevronDown size={16} className={shown(entry.id) ? '' : '-rotate-90'}/>
              </button>
              <button type="button" onClick={() => onOpen(entry)}
                className="min-w-0 flex-1 rounded-md text-left text-white focus-visible:outline"
                aria-label={`Read diary entry from ${time}`}>
                <span className="block truncate text-sm font-medium">
                  {entry.emoji ? `${entry.emoji} ` : ''}{entry.content?.trim().split('\n')[0] || 'Diary entry'}
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
          onClick={() => setVisibleLimit(limit => limit + 30)}
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
  entryOverride?: DiaryDocument;
}> = ({ date, dragHandleRef, entryOverride }) => {
  const { getEntriesByDate, createEntry, updateEntry, deleteEntryById } = useDiary(entryOverride === undefined);
  const { getSetting, setSetting } = useSettings();
  const [selection, setSelection] = useState<{ entryId: string | null; mode: 'read' | 'edit' } | null>(null);
  const entries = entryOverride ? [entryOverride] : getEntriesByDate(date);
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
      <div className="my-2 min-w-0">
        <DiaryDayGroup key={`${date}:${expanded}`} date={date} entries={entries}
          onOpen={entry => setSelection({ entryId: entry.id, mode: 'read' })}
          onEdit={entry => setSelection({ entryId: entry.id, mode: 'edit' })}
          onNew={() => setSelection({ entryId: null, mode: 'edit' })}
          expanded={expanded} dragHandleRef={dragHandleRef}
          orderMode={entryOrderMode} manualOrder={savedManualOrder}
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
        onSave={async (day, body, visibility, emoji, photos) => {
          if (diarySession.entryId) {
            await updateEntry(diarySession.entryId, day, body, visibility, emoji, photos);
          } else await createEntry(day, body, visibility, emoji, photos);
        }}
        onDelete={diarySession.entryId ? async () => deleteEntryById(diarySession.entryId!) : undefined}
        initialEditing={diarySession.mode === 'edit'}
        onClose={() => setSelection(null)} /></Suspense>}
    </>
  );
};
