import React, { useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';

interface CalendarCategoryFilterPopupProps {
  categories: CategoryDocument[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const CalendarCategoryFilterPopup: React.FC<CalendarCategoryFilterPopupProps> = ({
  categories, selectedIds, onToggle, onClear, onClose, triggerRef,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    popupRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!popupRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, triggerRef]);
  const selected = new Set(selectedIds);

  return (
    <div ref={popupRef} role="dialog" aria-label="Filter calendar by category"
      data-route-swipe-ignore="true"
      onPointerDown={event => event.stopPropagation()}
      className="absolute right-[-5rem] top-full z-[70] mt-2 flex max-h-[min(70dvh,28rem)] w-[min(18rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-surface p-2 text-textPrimary shadow-2xl">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="mosaic-general-text text-sm font-semibold">Filter calendar</span>
        <button type="button" onClick={onClose} aria-label="Close calendar filter"
          className="mosaic-action-icon rounded-lg p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <button type="button" onClick={onClear} aria-pressed={selected.size === 0}
          className="mosaic-general-text flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surfaceHighlight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <span>All categories</span>
          {selected.size === 0 && <Check size={16} aria-hidden="true" />}
        </button>
        {categories.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">No categories yet</p>}
        {categories.map(category => (
          <button type="button" key={category.id} role="checkbox" aria-checked={selected.has(category.id)}
            onClick={() => onToggle(category.id)}
            className="mosaic-general-text flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surfaceHighlight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate" title={category.name}>{category.name}</span>
            {selected.has(category.id) && <Check size={16} className="shrink-0" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 pt-2">
        <span className="mosaic-general-text text-xs text-gray-400">
          {selected.size > 0 ? selected.size + ' selected' : 'Showing all'}
        </span>
        {selected.size > 0 && (
          <button type="button" onClick={onClear}
            className="mosaic-general-text rounded px-2 py-1 text-xs text-gray-400 hover:text-textPrimary focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
};
