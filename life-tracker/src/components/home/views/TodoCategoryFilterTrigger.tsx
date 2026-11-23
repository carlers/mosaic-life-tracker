import React, { useCallback, useRef, useState } from 'react';
import { ListFilter } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';

const LazyCategoryPopup = React.lazy(() => import('./CalendarCategoryFilterPopup').then(
  ({ CalendarCategoryFilterPopup }) => ({ default: CalendarCategoryFilterPopup })
));

/** Todo's category-only filter deliberately does not borrow Calendar's
 * text-search persistence contract. Both views share the accessible category
 * popup, but only Calendar offers title filtering. */
export const TodoCategoryFilterTrigger: React.FC<{
  categories: CategoryDocument[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}> = ({ categories, selectedIds, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="relative shrink-0" data-route-swipe-ignore="true">
      <button type="button" ref={buttonRef}
        onPointerDown={event => event.stopPropagation()}
        onClick={() => setOpen(value => !value)}
        aria-label={selectedIds.length
          ? 'Filter to-do list categories, ' + selectedIds.length + ' selected'
          : 'Filter to-do list categories'}
        aria-haspopup="dialog" aria-expanded={open}
        aria-pressed={selectedIds.length > 0}
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
          <LazyCategoryPopup categories={categories} selectedIds={selectedIds}
            categoryOnly textQuery="" onTextChange={() => {}}
            onToggle={onToggle} onClear={onClear} onClose={close}
            triggerRef={buttonRef} />
        </React.Suspense>
      )}
    </div>
  );
};
