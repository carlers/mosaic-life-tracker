import React, { useCallback, useRef, useState } from 'react';
import { ListFilter } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';

const LazyPopup = React.lazy(() => import('./CalendarCategoryFilterPopup').then(
  ({ CalendarCategoryFilterPopup }) => ({ default: CalendarCategoryFilterPopup })
));

interface Props {
  categories: CategoryDocument[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export const CalendarCategoryFilterTrigger: React.FC<Props> = ({
  categories, selectedIds, onToggle, onClear,
}) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="relative shrink-0" data-route-swipe-ignore="true">
      <button type="button" ref={buttonRef}
        onPointerDown={event => event.stopPropagation()}
        onClick={() => setOpen(value => !value)}
        aria-label={selectedIds.length
          ? 'Filter calendar categories, ' + selectedIds.length + ' selected'
          : 'Filter calendar categories'}
        aria-haspopup="dialog" aria-expanded={open}
        className="mosaic-action-icon relative flex h-7 w-8 items-center justify-center rounded-lg bg-surface text-textSecondary hover:text-textPrimary focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
        <ListFilter size={16} aria-hidden="true" />
        {selectedIds.length > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] font-semibold text-black">
            {selectedIds.length > 9 ? '9+' : selectedIds.length}
          </span>
        )}
      </button>
      {open && (
        <React.Suspense fallback={null}>
          <LazyPopup categories={categories} selectedIds={selectedIds}
            onToggle={onToggle} onClear={onClear}
            onClose={close} triggerRef={buttonRef} />
        </React.Suspense>
      )}
    </div>
  );
};

export default CalendarCategoryFilterTrigger;
