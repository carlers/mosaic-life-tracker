import React, { useCallback, useRef, useState } from 'react';
import { ListFilter } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';
import { selectCalendarCategoryIds } from '../../../lib/calendarCategoryFilter';

const LazyPopup = React.lazy(() => import('./CalendarCategoryFilterPopup').then(
  ({ CalendarCategoryFilterPopup }) => ({ default: CalendarCategoryFilterPopup })
));

interface Props {
  categories: CategoryDocument[];
  selectedIds: readonly string[];
  textQuery: string;
  onTextChange: (query: string) => void;
  userId: string;
  liveIdsRef: React.RefObject<string[]>;
  writesRef: React.RefObject<Promise<void>>;
  onUpdateIds: (ids: string[]) => void;
  onWriteComplete: (ids: string[]) => void;
  saveIds: (ids: string[]) => Promise<void>;
}

export const CalendarCategoryFilterTrigger: React.FC<Props> = ({
  categories, selectedIds, textQuery, onTextChange, userId,
  liveIdsRef, writesRef, onUpdateIds, onWriteComplete, saveIds,
}) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  // Only the user-triggered lazy module queues writes; Home retains the refs through view switches.
  const persist = (ids: string[]) => {
    if (!userId) return;
    const next = selectCalendarCategoryIds(ids, categories);
    liveIdsRef.current = next;
    onUpdateIds(next);
    writesRef.current = writesRef.current.catch(() => undefined).then(() => saveIds(next));
    void writesRef.current.then(() => onWriteComplete(next), error => {
      console.error('Calendar filter save failed', error);
      onWriteComplete(next);
    });
  };
  const toggle = (id: string) => {
    if (!categories.some(category => category.id === id)) return;
    const ids = liveIdsRef.current;
    persist(ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  };
  return (
    <div className="relative shrink-0" data-route-swipe-ignore="true">
      <button type="button" ref={buttonRef}
        onPointerDown={event => event.stopPropagation()}
        onClick={() => setOpen(value => !value)}
        aria-label={selectedIds.length
          ? 'Filter calendar categories, ' + selectedIds.length + ' selected' + (textQuery.trim() ? ', text active' : '')
          : textQuery.trim() ? 'Filter calendar categories, text active' : 'Filter calendar categories'}
        aria-haspopup="dialog" aria-expanded={open}
        aria-pressed={Boolean(selectedIds.length || textQuery.trim())}
        className="mosaic-action-icon relative flex h-7 w-8 items-center justify-center rounded-lg bg-surface text-textSecondary hover:text-textPrimary focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
        <ListFilter size={16} aria-hidden="true" />
        {selectedIds.length > 0 ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] font-semibold text-black">
            {selectedIds.length > 9 ? '9+' : selectedIds.length}
          </span>
        ) : textQuery.trim() ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
        ) : null}
      </button>
      {open && (
        <React.Suspense fallback={null}>
          <LazyPopup categories={categories} selectedIds={selectedIds}
            textQuery={textQuery} onTextChange={onTextChange}
            onToggle={toggle} onClear={() => persist([])}
            onClose={close} triggerRef={buttonRef} />
        </React.Suspense>
      )}
    </div>
  );
};

export default CalendarCategoryFilterTrigger;
