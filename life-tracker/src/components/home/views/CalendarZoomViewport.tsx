import React, { useLayoutEffect, useRef } from 'react';
import type { CalendarZoomDays } from '../../../lib/preferences';

interface CalendarZoomViewportProps {
  zoomDays: Exclude<CalendarZoomDays, 7>;
  children: React.ReactNode;
  onZoomMount?: (element: HTMLDivElement, days: number) => void;
  onZoomScroll?: (element: HTMLDivElement, days: number) => void;
}

/**
 * One horizontal scroll owner for all seven weekday columns and every row.
 * Natural height leaves vertical scrolling to CalendarCarousel's month slide.
 */
export const CalendarZoomViewport: React.FC<CalendarZoomViewportProps> = ({
  zoomDays, children, onZoomMount, onZoomScroll,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (viewportRef.current) onZoomMount?.(viewportRef.current, zoomDays);
  }, [onZoomMount, zoomDays]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey ||
      event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.parentElement?.matches('[role="gridcell"]')) return;
    const delta = event.key === 'ArrowRight' ? 1 :
      event.key === 'ArrowLeft' ? -1 :
      event.key === 'ArrowDown' ? 7 :
      event.key === 'ArrowUp' ? -7 : 0;
    if (delta === 0) return;
    const days = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="gridcell"] > button:not(:disabled)')];
    const index = days.indexOf(target);
    const next = days[index + delta];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    next.scrollIntoView?.({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  };

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Scrollable calendar weekdays"
      tabIndex={0}
      data-calendar-zoom-lane="true"
      data-zoom-days={zoomDays}
      className="max-w-full overflow-x-auto overscroll-x-contain"
      style={{ touchAction: 'auto' }}
      onKeyDown={handleKeyDown}
      onFocusCapture={(event) => {
        if (event.target !== event.currentTarget &&
          event.target instanceof HTMLElement &&
          event.target.closest('[role="gridcell"]')) {
          event.target.scrollIntoView?.({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
      }}
      onScroll={(event) => onZoomScroll?.(event.currentTarget, zoomDays)}
    >
      <div style={{ width: `${(7 / zoomDays) * 100}%` }}>
        {children}
      </div>
    </div>
  );
};
