import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { BookOpenText, Plus, Images, ChevronDown, ChevronRight } from 'lucide-react';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
import { useDiary } from '../../../hooks/useDiary';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { useSettings } from '../../../hooks/useSettings';
import type { DiaryDocument } from '../../../db/schema';
import { DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, resolveDiaryDayViewHeight } from '../../../lib/preferences';
const DiaryEntrySheet = lazy(() => import('./DiaryEntrySheet').then(m => ({ default: m.DiaryEntrySheet })));
import { diaryMarker } from '../../../lib/diaryMarker';

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

/** Shared read-only selection/group UI. No entry content or expanded state is synchronized. */
export const DiaryDayGroup: React.FC<{
  date: string;
  entries: readonly DiaryDocument[];
  onOpen: (entry: DiaryDocument) => void;
  onNew?: () => void;
  onEdit?: (entry: DiaryDocument) => void;
  expanded?: boolean;
  dragHandleRef?: React.Ref<HTMLButtonElement>;
}> = ({ date, entries, onOpen, onNew, onEdit, expanded = false, dragHandleRef }) => {
  const [newestFirst, setNewestFirst] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const sorted = [...entries].sort((a, b) => (newestFirst ? -1 : 1) *
    ((a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id)));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [expandedDefault, setExpandedDefault] = useState(expanded);
  useEffect(() => { setExpandedIds(new Set()); setExpandedDefault(expanded); setVisibleLimit(30); }, [date, expanded]);
  const shown = (id: string) => expandedDefault !== expandedIds.has(id);
  const setAll = (next: boolean) => { setExpandedDefault(next); setExpandedIds(new Set()); };
  const toggle = (id: string) => setExpandedIds(old => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
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
  return (
    <section className="min-w-0 rounded-lg bg-surfaceHighlight p-2" data-testid="diary-day-group" aria-label={`Diary, ${sorted.length} entries on ${date}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" ref={dragHandleRef}
          aria-label={`Diary group, ${sorted.length} entries`}
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-white focus-visible:outline">
          <BookOpenText size={16}/> {sorted.length} diary entries
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setNewestFirst(value => !value)}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-surfaceHighlight focus-visible:outline"
            aria-label="Toggle diary entry order">{newestFirst ? 'Newest first' : 'Oldest first'}</button>
          <button type="button" onClick={() => setAll(!allExpanded)}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-surfaceHighlight focus-visible:outline">
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          {onNew && <button type="button" onClick={onNew}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-white hover:bg-surfaceHighlight focus-visible:outline"><Plus size={15}/> New entry</button>}
        </div>
      </div>
      <div className="space-y-1">
        {sorted.slice(0, visibleLimit).map(entry => (
          <div key={entry.id} className="min-w-0 rounded-lg bg-surface p-2">
            <div className="flex min-w-0 items-start gap-2">
              <button type="button" onClick={() => toggle(entry.id)}
                aria-label={shown(entry.id) ? 'Collapse entry' : 'Expand entry'}
                aria-expanded={shown(entry.id)}
                className="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 focus-visible:outline">
                {shown(entry.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
              </button>
              <button type="button" onClick={() => onOpen(entry)}
                className="min-w-0 flex-1 rounded-md text-left text-white focus-visible:outline"
                aria-label={`Read diary entry from ${new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}>
                <span className="block truncate text-sm font-medium">{entry.emoji ? `${entry.emoji} ` : ''}{entry.content?.trim().split('\n')[0] || 'Diary entry'}</span>
                <span className="block text-xs text-gray-400">{new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </button>
              {onEdit && <button type="button" onClick={() => onEdit(entry)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-surfaceHighlight focus-visible:outline"
                aria-label="Edit selected diary entry">Edit</button>}
            </div>
            {shown(entry.id) && <p className="mt-2 whitespace-pre-wrap break-words px-2 text-sm text-white">
              {(entry.content || '').slice(0, 1200)}
              {(entry.content || '').length > 1200 ? '…' : ''}
            </p>}
          </div>
        ))}
      </div>
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
  const { getSetting } = useSettings();
  const [selection, setSelection] = useState<{ entryId: string | null; mode: 'read' | 'edit' } | null>(null);
  const entries = entryOverride ? [entryOverride] : getEntriesByDate(date);
  const picked = selection?.entryId ? entries.find(entry => entry.id === selection.entryId) : undefined;
  const { value: diarySession, onExitComplete: clearDiarySession } = useRetainedSheetValue(
    selection ? { id: `${date}:${selection.entryId || 'new'}:${selection.mode}`, date,
      mode: selection.mode, entry: picked, entryId: selection.entryId } : null,
    selection !== null
  );
  const expanded = resolveDiaryDayViewHeight(getSetting(DIARY_DAY_VIEW_HEIGHT_SETTING_KEY, 'compact')) === 'expanded';
  return (
    <>
      <div className="my-2 min-w-0">
        <DiaryDayGroup date={date} entries={entries}
          onOpen={entry => setSelection({ entryId: entry.id, mode: 'read' })}
          onEdit={entry => setSelection({ entryId: entry.id, mode: 'edit' })}
          onNew={() => setSelection({ entryId: null, mode: 'edit' })}
          expanded={expanded} dragHandleRef={dragHandleRef}/>
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
