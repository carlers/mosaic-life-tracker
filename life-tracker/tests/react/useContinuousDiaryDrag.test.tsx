import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Swiper as SwiperClass } from 'swiper';
import type { CategoryDocument, DiaryDocument } from '../../src/db/schema';
import { adjacentCalendarDate } from '../../src/components/home/views/crossDayTaskDrag';
import { useContinuousDiaryDrag } from '../../src/components/home/views/useContinuousDiaryDrag';

const source = '2026-09-15';
const entry: DiaryDocument = {
  id: 'owner_note', userId: 'user_1', date: source, content: 'Original private note',
  emoji: '📝', photos: '[]', visibility: 'private',
  createdAt: '2026-09-15T00:00:00Z', updatedAt: '2026-09-15T00:00:00Z', isDeleted: false,
};
const category = { id: 'cat_0', userId: 'user_1', isDeleted: false } as CategoryDocument;
type TestHost = ReturnType<typeof makeHost>;

function firePointer(target: Element, type: string, x: number, y = 300) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 }, buttons: { value: type === 'pointerup' ? 0 : 1 },
    isPrimary: { value: true }, pointerId: { value: 23 },
    pointerType: { value: 'mouse' }, clientX: { value: x }, clientY: { value: y },
  });
  target.dispatchEvent(event);
}

function makeHost() {
  document.body.innerHTML = `<div id="swiper">
    <div class="swiper-slide-active">
      <div data-testid="day-slide" data-date-str="${source}">
        <div data-task-category-id="cat_0">
          <div data-diary-drag-source="true">
            <button data-diary-drag-heading="true">2 grouped</button>
          </div>
          <div data-diary-note-row="owner_note">Note</div>
          <div data-diary-note-row="other_note">Existing destination note</div>
          <div data-diary-reorder-id="owner_note">Group note</div>
          <button data-category-pill="true">Category</button>
        </div>
      </div>
    </div>
  </div>`;
  const rail = document.getElementById('swiper')!;
  const slide = rail.querySelector<HTMLElement>('[data-date-str]')!;
  const heading = rail.querySelector<HTMLElement>('[data-diary-drag-heading]')!;
  const note = rail.querySelector<HTMLElement>('[data-diary-note-row="owner_note"]')!;
  const otherNote = rail.querySelector<HTMLElement>('[data-diary-note-row="other_note"]')!;
  otherNote.getBoundingClientRect = () => ({
    left: 130, right: 420, top: 270, bottom: 310, width: 290, height: 40,
    x: 130, y: 270, toJSON: () => ({}),
  } as DOMRect);
  const pill = rail.querySelector<HTMLElement>('[data-category-pill]')!;
  const categoryRow = rail.querySelector<HTMLElement>('[data-task-category-id]')!;
  const rect = { left: 100, top: 60, right: 460, bottom: 740,
    width: 360, height: 680, x: 100, y: 60, toJSON: () => ({}) } as DOMRect;
  rail.getBoundingClientRect = () => rect;
  slide.getBoundingClientRect = () => rect;
  categoryRow.getBoundingClientRect = () => rect;
  const oldElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => categoryRow;
  let current = source;
  const swiper = {
    el: rail, destroyed: false, animating: false, activeIndex: 90,
    params: { speed: 0 },
    slideTo: vi.fn((index: number) => {
      const prior = swiper.activeIndex;
      swiper.activeIndex = index;
      if (index !== prior) current = adjacentCalendarDate(current, index > prior ? 1 : -1);
      slide.dataset.dateStr = current;
    }),
  } as unknown as SwiperClass;
  const ref = { current: swiper } as React.MutableRefObject<SwiperClass | null>;
  const onCommit = vi.fn(async () => undefined);
  const onFeedback = vi.fn();
  const onDateSettled = vi.fn();
  const onExternalFinished = vi.fn();
  const options = {
    isOpen: true, currentUserId: 'user_1', swiperRef: ref, categories: [category],
    onCommit, onFeedback, onDateSettled, onExternalFinished,
  };
  return { rail, slide, heading, note, otherNote, pill, swiper, ref, options,
    onCommit, onDateSettled, onExternalFinished,
    cleanup: () => { document.elementFromPoint = oldElementFromPoint; } };
}
const rect = { left: 120, top: 250, width: 180, height: 40 };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-15T10:00:00Z')); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('held Diary cross-day edge navigation', () => {
  async function start(host: TestHost, kind: 'note' | 'group') {
    const { result, unmount } = renderHook(() => useContinuousDiaryDrag(host.options));
    const sourceNode = kind === 'group' ? host.heading : host.note;
    act(() => {
      firePointer(sourceNode, 'pointerdown', 170);
      result.current.start(kind, [entry], source, rect);
      firePointer(window.document.body, 'pointermove', 450);
    });
    return { result, unmount };
  }

  it.each(['note', 'group'] as const)('continues across two days while %s stays held, then reverses', async kind => {
    const host = makeHost();
    try {
      const { result, unmount } = await start(host, kind);
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(host.slide.dataset.dateStr).toBe('2026-09-16');
      expect(result.current.projection?.kind).toBe(kind);
      expect(host.onDateSettled).toHaveBeenCalledTimes(1);
      expect(result.current.onNativeEnd(kind, kind === 'note' ? entry.id : undefined)).toBe(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(host.slide.dataset.dateStr).toBe('2026-09-17');
      act(() => firePointer(window.document.body, 'pointermove', 105));
      await act(async () => { await vi.advanceTimersByTimeAsync(450); });
      expect(host.slide.dataset.dateStr).toBe('2026-09-16');
      act(() => firePointer(window.document.body, 'pointerup', 270));
      await act(async () => { await Promise.resolve(); });
      expect(host.onCommit).toHaveBeenCalledTimes(1);
      expect(host.onCommit).toHaveBeenCalledWith(expect.objectContaining({
        kind, sourceDate: source, date: '2026-09-16', entries: [entry],
      }));
      expect(result.current.projection).toBeNull();
      unmount();
    } finally { host.cleanup(); }
  });

  it('preserves the exact neighboring Diary note and drop side after crossing days', async () => {
    const host = makeHost();
    try {
      const { unmount } = await start(host, 'note');
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      document.elementFromPoint = () => host.otherNote;
      act(() => firePointer(window.document.body, 'pointermove', 260, 275));
      await act(async () => { await vi.advanceTimersByTimeAsync(20); });
      act(() => firePointer(window.document.body, 'pointerup', 260, 275));
      await act(async () => { await Promise.resolve(); });
      expect(host.onCommit).toHaveBeenCalledWith(expect.objectContaining({
        targetNoteId: 'other_note', targetNoteSide: 'before', date: '2026-09-16',
      }));
      unmount();
    } finally { host.cleanup(); }
  });

  it('cancels an off-surface release instead of writing a default category', async () => {
    const host = makeHost();
    try {
      const { result, unmount } = await start(host, 'note');
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      act(() => firePointer(document.body, 'pointerup', 490));
      await act(async () => { await Promise.resolve(); });
      expect(host.onCommit).not.toHaveBeenCalled();
      expect(result.current.projection).toBeNull();
      unmount();
    } finally { host.cleanup(); }
  });

  it('never paints or commits a previous account note after the owner changes', async () => {
    const host = makeHost();
    try {
      const { result, rerender, unmount } = renderHook(
        ({ owner }) => useContinuousDiaryDrag({ ...host.options, currentUserId: owner }),
        { initialProps: { owner: 'user_1' } },
      );
      act(() => {
        firePointer(host.note, 'pointerdown', 170);
        result.current.start('note', [entry], source, rect);
        firePointer(document.body, 'pointermove', 450);
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(result.current.projection?.entries[0].id).toBe(entry.id);
      rerender({ owner: 'user_2' });
      expect(result.current.projection).toBeNull();
      expect(document.querySelector('[data-cross-day-diary-overlay]')).toBeNull();
      act(() => firePointer(document.body, 'pointerup', 270));
      await act(async () => { await vi.advanceTimersByTimeAsync(60); });
      expect(host.onCommit).not.toHaveBeenCalled();
      unmount();
    } finally { host.cleanup(); }
  });

  it('does not commit a note if the pointer is released before crossing, canceled or Escape is pressed', async () => {
    const host = makeHost();
    try {
      const { result, unmount } = await start(host, 'note');
      act(() => firePointer(window.document.body, 'pointerup', 220));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(host.onCommit).not.toHaveBeenCalled();
      act(() => {
        firePointer(host.note, 'pointerdown', 170);
        result.current.start('note', [entry], source, rect);
        firePointer(window.document.body, 'pointermove', 450);
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(450); });
      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(host.onCommit).not.toHaveBeenCalled();
      expect(result.current.projection).toBeNull();
      unmount();
    } finally { host.cleanup(); }
  });

  it('ignores category pill holds even when the user moves to an edge', async () => {
    const host = makeHost();
    try {
      const { result, unmount } = renderHook(() => useContinuousDiaryDrag(host.options));
      act(() => {
        firePointer(host.pill, 'pointerdown', 170);
        result.current.start('note', [entry], source, rect);
        firePointer(window.document.body, 'pointermove', 450);
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
      expect(host.slide.dataset.dateStr).toBe(source);
      expect(host.onCommit).not.toHaveBeenCalled();
      expect(result.current.projection).toBeNull();
      unmount();
    } finally { host.cleanup(); }
  });
});
