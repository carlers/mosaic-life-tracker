import React, { useRef } from 'react';
import { clampDayPanelWidth, DAY_PANEL_MIN_WIDTH, maxDayPanelWidth, type DayPanelSide } from '../../../lib/dayPanelLayout';

interface Props {
  side: DayPanelSide;
  width: number;
  frameWidth: number;
  frameRef: React.RefObject<HTMLDivElement | null>;
  screenHeight?: boolean;
  onResize: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onCommit: (width: number) => void;
}

export const DayPanelResizeHandle: React.FC<Props> = ({ side, width, frameWidth, frameRef, screenHeight, onResize, onCommit, onResizeStart, onResizeEnd }) => {
  const dragging = useRef<number | null>(null);
  const lastWidth = useRef(width);
  const resize = (value: number) => {
    const next = clampDayPanelWidth(value, frameWidth);
    lastWidth.current = next;
    onResize(next);
  };
  return (
    <div role="separator" tabIndex={0} aria-label="Resize day details panel"
      aria-orientation="vertical" aria-valuemin={DAY_PANEL_MIN_WIDTH}
      aria-valuemax={maxDayPanelWidth(frameWidth)} aria-valuenow={width}
      aria-valuetext={`${width} pixels`} data-testid="day-panel-resize-handle"
      className="swiper-no-swiping relative z-10 flex h-full w-3 shrink-0 cursor-col-resize touch-none select-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      onPointerDown={event => {
        if (event.button !== 0 || dragging.current !== null) return;
        event.preventDefault();
        event.stopPropagation();
        dragging.current = event.pointerId;
        onResizeStart?.();
        lastWidth.current = width;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (dragging.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = (screenHeight
          ? frameRef.current?.closest('.mosaic-home-workspace') : frameRef.current
        )?.getBoundingClientRect();
        if (!rect) return;
        resize(side === 'left' ? event.clientX - rect.left : rect.right - event.clientX);
      }}
      onPointerUp={event => {
        if (dragging.current !== event.pointerId) return;
        event.stopPropagation();
        dragging.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        onCommit(lastWidth.current);
        onResizeEnd?.();
      }}
      onPointerCancel={event => {
        if (dragging.current !== event.pointerId) return;
        dragging.current = null;
        onCommit(lastWidth.current);
        onResizeEnd?.();
      }}
      onKeyDown={event => {
        const step = event.shiftKey ? 40 : 20;
        let next: number | null = null;
        if (event.key === 'ArrowLeft') next = width + (side === 'left' ? -step : step);
        if (event.key === 'ArrowRight') next = width + (side === 'left' ? step : -step);
        if (event.key === 'Home') next = DAY_PANEL_MIN_WIDTH;
        if (event.key === 'End') next = maxDayPanelWidth(frameWidth);
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        const result = clampDayPanelWidth(next, frameWidth);
        resize(result);
        onCommit(result);
      }}
    >
      <div aria-hidden="true" className="h-14 w-1 rounded-full bg-[var(--mosaic-border)]" />
    </div>
  );
};
