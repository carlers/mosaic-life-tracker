import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Swiper as SwiperClass } from 'swiper';
import { useCrossDayLanding } from '../../src/components/home/views/useCrossDayLanding';

const date = '2026-10-02';
const taskId = 'new_task';
let swiperEl: HTMLElement;
let overlayEl: HTMLDivElement;
let slideEl: HTMLElement;
let originalMatchMedia: typeof window.matchMedia;

function makeHost() {
  document.body.innerHTML = `<div id="swiper"><div class="swiper-slide-active">
    <div data-date-str="${date}">
      <div data-cross-day-reorder-slot="true"></div>
      <div data-task-id="${taskId}">Moved task</div>
      <div data-diary-note-row="new_note">Moved diary note</div>
      <div data-testid="diary-day-group" data-diary-drag-group="true">Group</div>
    </div>
  </div></div>`;
  swiperEl = document.getElementById('swiper')!;
  slideEl = swiperEl.querySelector<HTMLElement>('[data-date-str]')!;
  for (const node of slideEl.querySelectorAll<HTMLElement>('*')) {
    node.getBoundingClientRect = () => ({
      left: 140, top: 190, right: 380, bottom: 242,
      x: 140, y: 190, width: 240, height: 52, toJSON: () => ({}),
    } as DOMRect);
  }
  overlayEl = document.createElement('div');
  overlayEl.dataset.crossDayDragOverlay = 'true';
  overlayEl.style.position = 'fixed';
  overlayEl.style.width = '180px';
  overlayEl.style.transform = 'translate3d(220px, 300px, 0)';
  document.body.append(overlayEl);
  const swiper = { el: swiperEl, destroyed: false } as SwiperClass;
  const swiperRef = { current: swiper } as React.MutableRefObject<SwiperClass | null>;
  const overlayRef = { current: overlayEl } as React.MutableRefObject<HTMLDivElement | null>;
  return { swiperRef, overlayRef, cleanup: () => { overlayEl.remove(); document.body.innerHTML = ''; } };
}
const flush = async (ms = 16) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.head.querySelectorAll('[data-cross-day-landing-style]').forEach(node => node.remove());
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('cross-day drop-to-render landing', () => {
  it('keeps task visible after release, follows destination, and only reveals the row when ready', async () => {
    const host = makeHost();
    try {
      let finishCommit!: () => void;
      const commit = vi.fn(() => new Promise<void>(resolve => { finishCommit = resolve; }));
      const releaseSlot = vi.fn();
      const error = vi.fn();
      const { result, unmount } = renderHook(() =>
        useCrossDayLanding(true, 'user_A', host.swiperRef, host.overlayRef));
      act(() => result.current.begin({
        snapshot: { id: taskId }, target: { date, kind: 'task', id: taskId },
        commit, releaseSlot, onError: error,
      }));
      await flush(50);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(result.current.landing?.phase).toBe('pending');
      expect(document.head.querySelector('[data-cross-day-landing-style]')?.textContent)
        .toContain(taskId);
      expect(overlayEl.style.transform).toContain('140px');
      expect(releaseSlot).not.toHaveBeenCalled();

      await act(async () => { finishCommit(); await Promise.resolve(); });
      await flush(60);
      expect(releaseSlot).toHaveBeenCalledTimes(1);
      expect(result.current.landing).not.toBeNull();
      // The new row must not flash before the moving overlay reaches it.
      expect(result.current.landing?.phase).toBe('pending');
      await flush(220);
      expect(result.current.landing?.phase).toBe('reveal');
      expect(document.head.querySelector('[data-cross-day-landing-style]')).toBeNull();
      await flush(160);
      expect(result.current.landing).toBeNull();
      expect(error).not.toHaveBeenCalled();
      unmount();
    } finally { host.cleanup(); }
  });

  it('does not hide an existing Diary group while merging dragged entries', async () => {
    const host = makeHost();
    try {
      const { result, unmount } = renderHook(() =>
        useCrossDayLanding(true, 'user_A', host.swiperRef, host.overlayRef));
      const releaseSlot = vi.fn();
      act(() => result.current.begin({
        snapshot: { kind: 'group' },
        target: { date, kind: 'group', id: 'entry_1' },
        commit: async () => undefined, releaseSlot, onError: vi.fn(),
      }));
      expect(result.current.hideStyle).toBeFalsy();
      await flush(440);
      expect(result.current.landing).toBeNull();
      expect(releaseSlot).toHaveBeenCalledTimes(1);
      unmount();
    } finally { host.cleanup(); }
  });

  it('drops the landing overlay and reserved slot on a rejected write', async () => {
    const host = makeHost();
    try {
      const { result, unmount } = renderHook(() =>
        useCrossDayLanding(true, 'user_A', host.swiperRef, host.overlayRef));
      const releaseSlot = vi.fn();
      const error = vi.fn();
      act(() => result.current.begin({
        snapshot: { id: 'new_note' },
        target: { date, kind: 'note', id: 'new_note' },
        commit: async () => { throw new Error('disk rejected'); },
        releaseSlot, onError: error,
      }));
      await flush(40);
      expect(result.current.landing).toBeNull();
      expect(releaseSlot).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk rejected' }));
      unmount();
    } finally { host.cleanup(); }
  });

  it('does not continue an old account landing after an account switch', async () => {
    const host = makeHost();
    try {
      let finishCommit!: () => void;
      const { result, rerender, unmount } = renderHook(({ owner }) =>
        useCrossDayLanding(true, owner, host.swiperRef, host.overlayRef),
      { initialProps: { owner: 'user_A' } });
      const commit = vi.fn(() => new Promise<void>(resolve => { finishCommit = resolve; }));
      const releaseSlot = vi.fn();
      act(() => result.current.begin({
        snapshot: { id: taskId }, target: { date, kind: 'task', id: taskId },
        commit, releaseSlot, onError: vi.fn(),
      }));
      await flush(30);
      rerender({ owner: 'user_B' });
      await flush(35);
      expect(result.current.landing).toBeNull();
      await act(async () => { finishCommit(); await Promise.resolve(); });
      await flush(200);
      expect(releaseSlot).not.toHaveBeenCalled();
      unmount();
    } finally { host.cleanup(); }
  });
});
