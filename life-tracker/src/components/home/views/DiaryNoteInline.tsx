import React, { useContext, useEffect, useRef, useState } from 'react';
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
  timer: ReturnType<typeof setTimeout> | null;
}

export const DiaryNoteInline: React.FC<{
  entry: DiaryDocument;
  title: string;
  onOpen: () => void;
  onEdit?: () => void;
}> = ({ entry, title, onOpen, onEdit }) => {
  const interactions = useContext(DiaryNoteDayContext);
  const gestureRef = useRef<Gesture | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const activation = useDiaryEntryActivation(() => onOpen(), onEdit ? () => onEdit() : undefined);
  const [active, setActive] = useState(false);
  const suppressClick = useRef(false);

  const clearGesture = () => {
    const gesture = gestureRef.current;
    if (gesture?.timer) clearTimeout(gesture.timer);
    gestureRef.current = null;
    setActive(false);
    interactions?.onDragEnd();
  };
  useEffect(() => () => {
    if (gestureRef.current?.timer) clearTimeout(gestureRef.current.timer);
  }, []);
  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const preventScroll = (event: TouchEvent) => {
      if (gestureRef.current?.active && event.cancelable) event.preventDefault();
    };
    node.addEventListener('touchmove', preventScroll, { passive: false });
    return () => node.removeEventListener('touchmove', preventScroll);
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
        startX: event.clientX, startY: event.clientY, active: false, timer: null };
      gestureRef.current = gesture;
      suppressClick.current = false;
      gesture.timer = setTimeout(() => {
        if (gestureRef.current !== gesture) return;
        gesture.active = true;
        setActive(true);
        interactions.onDragStart(entry.id, rowRef.current!.getBoundingClientRect(),
          gesture.startX, gesture.startY, 'inline');
        suppressClick.current = true;
        try { rowRef.current?.setPointerCapture(gesture.id); } catch { /* released */ }
      }, 450);
    }}
    onPointerMove={event => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (!gesture.active) {
        if (Math.abs(event.clientX - gesture.startX) > 10 ||
            Math.abs(event.clientY - gesture.startY) > 10) clearGesture();
        return;
      }
      event.stopPropagation();
      interactions?.onDragMove(entry.id, event.clientX, event.clientY,
        rowRef.current?.getBoundingClientRect().height ?? 45);
    }}
    onPointerUp={event => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (gesture.active) {
        event.stopPropagation();
        interactions?.onDragRelease(entry.id, event.clientX, event.clientY);
      }
      clearGesture();
      if (rowRef.current?.hasPointerCapture(event.pointerId))
        rowRef.current.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={clearGesture}
    onLostPointerCapture={clearGesture}
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
};
