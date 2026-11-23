import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpenText } from 'lucide-react';
import type { DiaryDocument } from '../../../db/schema';
import { DiaryNoteDayContext } from './diaryNoteDayContext';
import { useDiaryEntryActivation } from './useDiaryEntryActivation';

interface Gesture {
  id: number;
  type: string;
  startX: number;
  startY: number;
  active: boolean;
  height: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface DiaryNoteInlineProps {
  entry: DiaryDocument;
  title: string;
  onOpen: (id: string) => void;
  onEdit?: (id: string) => void;
}

/** Keep stationary notes out of the hover render path. */
export const DiaryNoteInline = React.memo(function DiaryNoteInline({
  entry, title, onOpen, onEdit,
}: DiaryNoteInlineProps) {
  const interactions = useContext(DiaryNoteDayContext);
  const gestureRef = useRef<Gesture | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const activation = useDiaryEntryActivation(
    () => onOpen(entry.id), onEdit ? () => onEdit(entry.id) : undefined);
  const [active, setActive] = useState(false);
  const suppressClick = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);
  const interactionsRef = useRef(interactions);
  useLayoutEffect(() => { interactionsRef.current = interactions; }, [interactions]);

  const flushMove = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const point = pendingPointRef.current;
    pendingPointRef.current = null;
    const gesture = gestureRef.current;
    if (point && gesture?.active)
      interactionsRef.current?.onDragMove(entry.id, point.x, point.y, gesture.height);
  };
  const clearGesture = () => {
    const gesture = gestureRef.current;
    if (gesture?.timer) clearTimeout(gesture.timer);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingPointRef.current = null;
    gestureRef.current = null;
    unbindRef.current?.();
    unbindRef.current = null;
    setActive(false);
    if (gesture?.active) interactionsRef.current?.onDragEnd();
  };
  // A row may be moved by React when the full-height placeholder crosses a
  // task. Pointer capture on that moving row fires lostpointercapture and
  // cancels the gesture. Use one stable body capture and window listeners
  // for the active drag; release them immediately when it ends.
  const bindActiveGesture = (gesture: Gesture) => {
    const onMove = (event: PointerEvent) => {
      if (gestureRef.current !== gesture || event.pointerId !== gesture.id) return;
      event.stopPropagation();
      if (event.cancelable && gesture.type !== 'mouse') event.preventDefault();
      pendingPointRef.current = { x: event.clientX, y: event.clientY };
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const point = pendingPointRef.current;
        pendingPointRef.current = null;
        if (gestureRef.current === gesture && point)
          interactionsRef.current?.onDragMove(entry.id, point.x, point.y, gesture.height);
      });
    };
    const onUp = (event: PointerEvent) => {
      if (gestureRef.current !== gesture || event.pointerId !== gesture.id) return;
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
      flushMove(); // Commit the last pointer sample, even before its frame.
      interactionsRef.current?.onDragRelease(entry.id, event.clientX, event.clientY);
      clearGesture();
    };
    const onCancel = (event: PointerEvent) => {
      if (gestureRef.current !== gesture || event.pointerId !== gesture.id) return;
      event.stopPropagation();
      clearGesture();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (gestureRef.current === gesture && event.cancelable) event.preventDefault();
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    const owner = document.body; // Unlike the reordered row, never reparented.
    try { owner.setPointerCapture(gesture.id); } catch { /* unavailable/canceled */ }
    unbindRef.current = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      try {
        if (owner.hasPointerCapture?.(gesture.id)) owner.releasePointerCapture(gesture.id);
      } catch { /* pointer already released */ }
    };
  };
  useEffect(() => () => {
    const gesture = gestureRef.current;
    if (gesture?.timer) clearTimeout(gesture.timer);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    unbindRef.current?.();
    if (gesture?.active) interactionsRef.current?.onDragEnd();
  }, []);

  return <div ref={rowRef} data-diary-note-row={entry.id}
    className="relative min-w-0 rounded-lg py-2 pl-1 pr-2 text-white"
    style={{ touchAction: 'pan-y', cursor: interactions ? (active ? 'grabbing' : 'grab') : undefined,
      zIndex: active ? 4 : undefined,
      opacity: interactions?.floatingEntryId === entry.id &&
        interactions?.floatingExternal ? 0 : undefined,
      boxShadow: active ? '0 8px 20px rgba(0,0,0,0.22)' : undefined }}
    onPointerDown={event => {
      activation.rememberPointer(event.pointerType);
      if (!interactions || event.button !== 0 || event.isPrimary === false ||
        gestureRef.current) return;
      const gesture: Gesture = { id: event.pointerId, type: event.pointerType,
        startX: event.clientX, startY: event.clientY, active: false,
        height: rowRef.current?.getBoundingClientRect().height ?? 45, timer: null };
      gestureRef.current = gesture;
      suppressClick.current = false;
      gesture.timer = setTimeout(() => {
        if (gestureRef.current !== gesture) return;
        gesture.active = true;
        setActive(true);
        const row = rowRef.current;
        if (!row) { clearGesture(); return; }
        interactionsRef.current?.onDragStart(entry.id, row.getBoundingClientRect(),
          gesture.startX, gesture.startY, 'inline');
        suppressClick.current = true;
        bindActiveGesture(gesture);
      }, 450);
    }}
    onPointerMove={event => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (!gesture.active &&
          (Math.abs(event.clientX - gesture.startX) > 10 ||
           Math.abs(event.clientY - gesture.startY) > 10)) clearGesture();
      // An active gesture is handled by the stable window capture listener,
      // throttled to one collision/React update per animation frame.
    }}
    onPointerUp={event => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      // Active gestures finish at window capture, before React can move or
      // remount this row. Early pointer-up just cancels the long press.
      if (!gesture.active) clearGesture();
    }}
    onPointerCancel={event => {
      if (gestureRef.current?.id === event.pointerId) clearGesture();
    }}
    onDragStart={event => event.preventDefault()}
    onDoubleClick={onEdit ? () => activation.doubleClick(entry) : undefined}
    onClickCapture={event => {
      if (!suppressClick.current || event.detail === 0) return;
      event.stopPropagation(); event.preventDefault();
      suppressClick.current = false;
    }}>
    <button type="button" onClick={event => activation.activate(entry, event.detail)} className="flex min-w-0 w-full items-start gap-2 text-left outline-offset-2 focus-visible:outline">
      <BookOpenText size={18} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true"/>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{entry.emoji ? `${entry.emoji} ` : ''}{title}</span>
        {entry.content && <span className="mt-1 block line-clamp-2 whitespace-pre-wrap break-words text-xs text-gray-400">
          {entry.content.slice(0, 180)}</span>}
      </span>
    </button>
  </div>;
});
