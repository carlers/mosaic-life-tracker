import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import type { CategoryDocument } from '../../../db/schema';
import { placeCalendarCategoryPopup, type PopupPlacement } from '../../../lib/calendarCategoryPopupPlacement';

interface CalendarCategoryFilterPopupProps {
  categories: CategoryDocument[];
  label?: string;
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const CalendarCategoryFilterPopup: React.FC<CalendarCategoryFilterPopupProps> = ({
  categories, label = 'calendar', selectedIds, onToggle, onClear, onClose, triggerRef,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PopupPlacement | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const reposition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const visual = window.visualViewport;
      const viewport = {
        left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0,
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
      };
      if (rect.bottom < viewport.top || rect.top > viewport.top + viewport.height) {
        onClose();
        return;
      }
      const next = placeCalendarCategoryPopup(rect, categories.length, viewport, window.innerHeight);
      setPlacement(previous =>
        previous && previous.left === next.left && previous.width === next.width &&
        previous.top === next.top && previous.bottom === next.bottom &&
        previous.maxHeight === next.maxHeight ? previous : next);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; reposition(); });
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      schedule();
    };
    reposition();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [categories.length, onClose, triggerRef]);
  const positioned = placement !== null;
  useEffect(() => {
    if (positioned) popupRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [positioned]);
  useEffect(() => {
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

  if (!placement) return null;

  return createPortal(
    <div ref={popupRef} role="dialog" aria-label={'Filter ' + label + ' by category'}
      data-route-swipe-ignore="true"
      style={{ position: 'fixed', zIndex: 180, ...placement }}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => {
        // Calendar/route keyboard shortcuts must not fire while selecting categories.
        if (event.key !== 'Escape') event.stopPropagation();
      }}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-2 text-textPrimary shadow-2xl">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="mosaic-general-text text-sm font-semibold">{'Filter ' + label}</span>
        <button type="button" onClick={() => {
          onClose();
          triggerRef.current?.focus({ preventScroll: true });
        }} aria-label={'Close ' + label + ' filter'}
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
    </div>, document.body
  );
};
