import React from 'react';
import { createPortal } from 'react-dom';
import { BookOpenText } from 'lucide-react';
import type { Swiper as SwiperClass } from 'swiper';
import type { CategoryDocument, DiaryDocument } from '../../../db/schema';
import { adjacentCalendarDate, clampTaskInsertIndex, dragEdgeDirection } from './crossDayTaskDrag';
import { TOTAL_SLIDES } from './useDayViewSwiper';

const EDGE_DWELL_MS = 320;
const REPEAT_COOLDOWN_MS = 230;
const EDGE_RETRY_MS = 100;
type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };
export type DiaryDragKind = 'note' | 'group';
export type CrossDayDiaryDrop = {
  kind: DiaryDragKind;
  entries: readonly DiaryDocument[];
  sourceDate: string;
  date: string;
  categoryId: string;
  index: number;
  intoGroup: boolean;
};
type Held = { pointerId: number; pointerType: string; key: string; x: number; y: number;
  downX: number; downY: number; touchId: number | null };
type Session = CrossDayDiaryDrop & {
  key: string; stage: 'native' | 'external'; point: Point;
  pointerId: number; width: number; height: number; offset: Point;
  direction: -1 | 0 | 1; inFlight: boolean;
  lastIndex: number; expectedIndex: number | null; expectedDate: string | null;
};
export type CarriedDiary = CrossDayDiaryDrop & { height: number; width: number };
type Options = {
  isOpen: boolean;
  currentUserId: string;
  swiperRef: React.MutableRefObject<SwiperClass | null>;
  categories: readonly CategoryDocument[];
  onCommit: (drop: CrossDayDiaryDrop) => Promise<void>;
  onFeedback: (message: string) => void;
  onExternalFinished: () => void;
  onDateSettled: (swiper: SwiperClass) => void;
};

/** Swiper removes its original drag source on the first edge advance.
 * This controller owns that single physical pointer until release, but never
 * mutates Diary rows or preferences until a completed drop on a settled day. */
export function useContinuousDiaryDrag(options: Options) {
  const { swiperRef } = options;
  const latest = React.useRef(options);
  React.useLayoutEffect(() => { latest.current = options; });
  const heldRef = React.useRef<Held | null>(null);
  const sessionRef = React.useRef<Session | null>(null);
  const suppressedEndRef = React.useRef<string | null>(null);
  const dwellRef = React.useRef<number | null>(null);
  const cooldownRef = React.useRef<number | null>(null);
  const transitionRef = React.useRef<number | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const [carried, setCarried] = React.useState<CarriedDiary | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const clearTimers = React.useCallback(() => {
    for (const ref of [dwellRef, cooldownRef, transitionRef]) {
      if (ref.current !== null) window.clearTimeout(ref.current);
      ref.current = null;
    }
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);
  const cancel = React.useCallback(() => {
    clearTimers();
    sessionRef.current = null;
    heldRef.current = null;
    setCarried(null);
  }, [clearTimers]);
  const positionOverlay = React.useCallback((s: Session) => {
    if (overlayRef.current) overlayRef.current.style.transform =
      `translate3d(${s.point.x - s.offset.x}px, ${s.point.y - s.offset.y}px, 0)`;
  }, []);
  const project = React.useCallback((s: Session) => {
    if (s.stage !== 'external' || s.inFlight) return;
    const slide = swiperRef.current?.el?.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]');
    if (!slide || slide.dataset.dateStr !== s.date) return;
    const rect = slide.getBoundingClientRect();
    const x = Math.max(rect.left + 8, Math.min(s.point.x, rect.right - 8));
    const hit = document.elementFromPoint(x, s.point.y);
    const categoryNode = hit instanceof Element && slide.contains(hit)
      ? hit.closest<HTMLElement>('[data-task-category-id]') : null;
    const available = [...slide.querySelectorAll<HTMLElement>('[data-task-category-id]')]
      .filter(node => latest.current.categories.some(c =>
        c.id === node.dataset.taskCategoryId && c.userId === latest.current.currentUserId && !c.isDeleted));
    const matched = available.find(node => node === categoryNode);
    const fallback = available.find(node => node.dataset.taskCategoryId === s.categoryId) ?? available[0];
    const category = matched ?? fallback;
    const intoGroup = s.kind === 'note' && hit instanceof Element &&
      !!hit.closest('[data-diary-drag-group], [data-testid="diary-day-card"]');
    const rows = category ? [...category.querySelectorAll<HTMLElement>('[data-task-id]')]
      .filter(node => node.getBoundingClientRect().height > 0) : [];
    const slot = category?.querySelector<HTMLElement>('[data-cross-day-reorder-slot]');
    const slotRect = slot?.getBoundingClientRect();
    const retain = category?.dataset.taskCategoryId === s.categoryId && slotRect &&
      s.point.y >= slotRect.top - 10 && s.point.y <= slotRect.bottom + 10;
    const index = retain ? s.index : rows.filter(node => {
      const r = node.getBoundingClientRect();
      return r.top + r.height / 2 < s.point.y;
    }).length;
    s.categoryId = category?.dataset.taskCategoryId ?? '';
    s.index = clampTaskInsertIndex(index, rows.length);
    s.intoGroup = intoGroup;
    setCarried(current => current && current.date === s.date &&
      current.categoryId === s.categoryId && current.index === s.index &&
      current.intoGroup === s.intoGroup ? current : {
        kind: s.kind, entries: s.entries, sourceDate: s.sourceDate,
        date: s.date, categoryId: s.categoryId, index: s.index,
        intoGroup: s.intoGroup, height: s.height, width: s.width,
      });
  }, [swiperRef]);
  const queueProject = React.useCallback((s: Session) => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (sessionRef.current === s) project(s);
    });
  }, [project]);

  const advanceRef = React.useRef<() => void>(() => undefined);
  const scheduleRef = React.useRef<(delay: number) => void>(() => undefined);
  const settledRef = React.useRef<(date: string, swiper: SwiperClass) => boolean>(() => false);
  React.useLayoutEffect(() => {
    scheduleRef.current = (delay: number) => {
      if (dwellRef.current !== null) window.clearTimeout(dwellRef.current);
      const s = sessionRef.current;
      if (!s || s.inFlight || !s.direction) return;
      dwellRef.current = window.setTimeout(() => advanceRef.current(), delay);
    };
    settledRef.current = (date, swiper) => {
      const s = sessionRef.current;
      if (!s || s.stage !== 'external' || !s.inFlight || swiper !== swiperRef.current ||
          swiper.destroyed || swiper.activeIndex !== s.expectedIndex ||
          s.expectedDate !== date ||
          swiper.el.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]')?.dataset.dateStr !== date) return false;
      if (transitionRef.current !== null) window.clearTimeout(transitionRef.current);
      transitionRef.current = null;
      s.inFlight = false;
      s.lastIndex = swiper.activeIndex;
      s.expectedIndex = null;
      s.expectedDate = null;
      s.date = date;
      latest.current.onDateSettled(swiper);
      window.requestAnimationFrame(() => {
        if (sessionRef.current !== s) return;
        project(s);
        if (cooldownRef.current !== null) window.clearTimeout(cooldownRef.current);
        cooldownRef.current = window.setTimeout(() => {
          cooldownRef.current = null;
          if (sessionRef.current === s) scheduleRef.current(EDGE_DWELL_MS);
        }, REPEAT_COOLDOWN_MS);
      });
      return true;
    };
    advanceRef.current = () => {
      dwellRef.current = null;
      const s = sessionRef.current;
      const swiper = swiperRef.current;
      if (!s || !heldRef.current || heldRef.current.pointerId !== s.pointerId ||
          !s.direction || s.inFlight || !latest.current.isOpen ||
          s.entries.some(e => e.userId !== latest.current.currentUserId)) return;
      if (!swiper || swiper.destroyed || swiper.animating) {
        scheduleRef.current(EDGE_RETRY_MS);
        return;
      }
      if (swiper.activeIndex <= 2 || swiper.activeIndex >= TOTAL_SLIDES - 3) return;
      if (dragEdgeDirection(s.point.x, s.point.y, swiper.el.getBoundingClientRect()) !== s.direction) return;
      const content = swiper.el.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]');
      if (!content || content.dataset.dateStr !== s.date) {
        scheduleRef.current(EDGE_RETRY_MS);
        return;
      }
      if (s.stage === 'native') {
        s.stage = 'external';
        try { document.body.setPointerCapture(s.pointerId); } catch { /* unavailable */ }
        project(s);
        setCarried({ kind: s.kind, entries: s.entries, sourceDate: s.sourceDate,
          date: s.date, categoryId: s.categoryId, index: s.index,
          intoGroup: false, height: s.height, width: s.width });
      }
      s.inFlight = true;
      s.lastIndex = swiper.activeIndex;
      s.expectedIndex = swiper.activeIndex + s.direction;
      s.expectedDate = adjacentCalendarDate(s.date, s.direction);
      swiper.slideTo(s.expectedIndex);
      if (swiper.params.speed === 0) {
        window.requestAnimationFrame(() => {
          if (sessionRef.current === s && s.inFlight) settledRef.current(s.expectedDate ?? s.date, swiper);
        });
      }
      transitionRef.current = window.setTimeout(() => {
        if (sessionRef.current !== s || !s.inFlight) return;
        if (!swiper.destroyed && s.expectedDate &&
            settledRef.current(s.expectedDate, swiper)) return;
        s.inFlight = false;
        s.expectedIndex = null;
        s.expectedDate = null;
        if (!swiper.destroyed) swiper.slideTo(s.lastIndex, 0, false);
        s.direction = 0;
        latest.current.onFeedback('Day navigation paused. Move away and back to the edge.');
      }, Math.max(350, (swiper.params.speed || 0) + 300));
    };
  }, [project, swiperRef]);

  const updatePoint = React.useCallback((pointerId: number, x: number, y: number) => {
    const s = sessionRef.current;
    if (!s || pointerId !== s.pointerId) return;
    s.point = { x, y };
    if (s.stage === 'external') positionOverlay(s);
    const swiper = swiperRef.current;
    const next = swiper && !swiper.destroyed
      ? dragEdgeDirection(x, y, swiper.el.getBoundingClientRect()) : 0;
    if (next !== s.direction) {
      s.direction = next;
      if (dwellRef.current !== null) window.clearTimeout(dwellRef.current);
      dwellRef.current = null;
      if (!s.inFlight && next) scheduleRef.current(EDGE_DWELL_MS);
    }
    if (s.stage === 'external' && !s.inFlight) queueProject(s);
  }, [positionOverlay, queueProject, swiperRef]);
  const finish = React.useCallback((commit: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    const external = s.stage === 'external';
    if (external) suppressedEndRef.current = s.key;
    const swiper = swiperRef.current;
    if (s.inFlight && swiper && !swiper.destroyed) swiper.slideTo(s.lastIndex, 0, false);
    if (external) {
      try {
        if (document.body.hasPointerCapture(s.pointerId)) document.body.releasePointerCapture(s.pointerId);
      } catch { /* capture already released */ }
    }
    if (external && !s.inFlight) project(s);
    const viewport = swiper?.el.getBoundingClientRect();
    const accepted = external && commit && s.date !== s.sourceDate &&
      latest.current.isOpen &&
      s.entries.length > 0 &&
      s.entries.every(e => e.userId === latest.current.currentUserId && e.date === s.sourceDate) &&
      (!viewport || (s.point.y >= viewport.top && s.point.y <= viewport.bottom)) &&
      (s.kind === 'group' || s.intoGroup || !!s.categoryId);
    const drop: CrossDayDiaryDrop = {
      kind: s.kind, entries: s.entries, sourceDate: s.sourceDate,
      date: s.date, categoryId: s.categoryId, index: s.index, intoGroup: s.intoGroup,
    };
    cancel();
    if (external) latest.current.onExternalFinished();
    if (accepted) void Promise.resolve().then(() => latest.current.onCommit(drop))
      .catch(error => latest.current.onFeedback(
        error instanceof Error ? error.message : 'Could not move diary entries. Please try again.'));
  }, [cancel, project, swiperRef]);

  React.useEffect(() => {
    if (!options.isOpen) return;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.isPrimary === false ||
          ((e.pointerType === 'mouse' || e.pointerType === 'pen') && !(e.buttons & 1))) return;
      const el = e.target instanceof Element ? e.target : null;
      const group = el?.closest<HTMLElement>('[data-diary-drag-heading]') ??
        (el?.closest('[data-diary-drag-source]') ? el?.closest<HTMLElement>('[data-testid="diary-day-card"]') : null);
      const note = !group ? el?.closest<HTMLElement>('[data-diary-reorder-id], [data-diary-note-row]') : null;
      const source = group ?? note;
      const id = note?.dataset.diaryNoteRow ?? note?.dataset.diaryReorderId;
      const key = group ? 'group' : id ? `note:${id}` : null;
      if (!source || !key || !swiperRef.current?.el.contains(source) ||
          !source.closest('.swiper-slide-active')) return;
      heldRef.current = { pointerId: e.pointerId, pointerType: e.pointerType, key,
        x: e.clientX, y: e.clientY, downX: e.clientX, downY: e.clientY, touchId: null };
    };
    const move = (e: PointerEvent) => {
      const h = heldRef.current;
      if (!h || h.pointerId !== e.pointerId) return;
      if ((h.pointerType === 'mouse' || h.pointerType === 'pen') && !(e.buttons & 1)) {
        finish(false); return;
      }
      h.x = e.clientX; h.y = e.clientY;
      updatePoint(h.pointerId, h.x, h.y);
    };
    const up = (e: PointerEvent) => {
      if (heldRef.current?.pointerId !== e.pointerId) return;
      const s = sessionRef.current;
      if (s?.stage === 'external') updatePoint(e.pointerId, e.clientX, e.clientY);
      heldRef.current = null;
      finish(true);
    };
    const lost = (e: PointerEvent) => {
      if (heldRef.current?.pointerId !== e.pointerId) return;
      if (e.type === 'pointercancel' && heldRef.current.pointerType === 'touch' &&
          heldRef.current.touchId !== null && sessionRef.current?.stage === 'external') return;
      heldRef.current = null; finish(false);
    };
    const mouseUp = (e: MouseEvent) => {
      if (e.button === 0 && heldRef.current?.pointerType === 'mouse') finish(true);
    };
    // TouchEvents stay targeted at the original row even when Swiper removes
    // that slide. Keep end/cancel listeners attached directly to that source.
    let sourceTouchTarget: HTMLElement | null = null;
    const detachSourceTouch = () => {
      sourceTouchTarget?.removeEventListener('touchmove', touchMove, true);
      sourceTouchTarget?.removeEventListener('touchend', touchEnd, true);
      sourceTouchTarget?.removeEventListener('touchcancel', touchCancel, true);
      sourceTouchTarget = null;
    };
    const touchStart = (e: TouchEvent) => {
      const h = heldRef.current;
      if (h?.pointerType !== 'touch') return;
      if (e.touches.length > 1 && sessionRef.current) {
        heldRef.current = null;
        detachSourceTouch();
        finish(false);
        return;
      }
      if (e.touches.length === 1 && h.touchId === null) h.touchId = e.touches[0].identifier;
      if (!sourceTouchTarget && e.target instanceof Element) {
        sourceTouchTarget = e.target.closest<HTMLElement>(
          '[data-diary-drag-heading], [data-testid="diary-day-card"], [data-diary-reorder-id], [data-diary-note-row]');
        sourceTouchTarget?.addEventListener('touchmove', touchMove, { capture: true, passive: false });
        sourceTouchTarget?.addEventListener('touchend', touchEnd, true);
        sourceTouchTarget?.addEventListener('touchcancel', touchCancel, true);
      }
    };
    const touchMove = (e: TouchEvent) => {
      const h = heldRef.current;
      if (!h || h.pointerType !== 'touch' || sessionRef.current?.stage !== 'external' ||
          e.touches.length !== 1) return;
      const t = e.touches[0];
      if (h.touchId !== null && h.touchId !== t.identifier) return;
      if (e.cancelable) e.preventDefault();
      updatePoint(h.pointerId, t.clientX, t.clientY);
    };
    const touchEnd = (e: TouchEvent) => {
      const h = heldRef.current;
      if (h?.pointerType !== 'touch' || e.touches.length) return;
      if (h.touchId !== null && ![...e.changedTouches].some(t => t.identifier === h.touchId)) return;
      heldRef.current = null;
      detachSourceTouch();
      finish(true);
    };
    const touchCancel = (_e: TouchEvent) => {
      heldRef.current = null;
      detachSourceTouch();
      finish(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { heldRef.current = null; finish(false); }
    };
    const blur = () => { heldRef.current = null; detachSourceTouch(); finish(false); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', lost, true);
    window.addEventListener('mouseup', mouseUp, true);
    window.addEventListener('touchstart', touchStart, true);
    window.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    window.addEventListener('touchend', touchEnd, true);
    window.addEventListener('touchcancel', touchCancel, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', lost, true);
      window.removeEventListener('mouseup', mouseUp, true);
      window.removeEventListener('touchstart', touchStart, true);
      window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('touchend', touchEnd, true);
      window.removeEventListener('touchcancel', touchCancel, true);
      detachSourceTouch();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [options.isOpen, finish, swiperRef, updatePoint]);
  React.useEffect(() => {
    if (!options.isOpen) cancel();
  }, [options.isOpen, cancel]);
  React.useEffect(() => () => cancel(), [cancel]);

  const start = React.useCallback((kind: DiaryDragKind, entries: readonly DiaryDocument[],
    sourceDate: string, rect: Rect) => {
    const h = heldRef.current;
    const key = kind === 'group' ? 'group' : `note:${entries[0]?.id}`;
    if (!h || h.key !== key || !latest.current.isOpen || !entries.length ||
        entries.some(e => e.date !== sourceDate ||
          e.userId !== latest.current.currentUserId)) return;
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed) return;
    cancel();
    heldRef.current = h;
    suppressedEndRef.current = null;
    swiper.touchEventsData.isTouched = false;
    swiper.touchEventsData.isMoved = false;
    swiper.touchEventsData.startMoving = false;
    const s: Session = { kind, entries: [...entries], key,
      sourceDate, date: sourceDate, categoryId: '', index: 0,
      intoGroup: false, stage: 'native', point: { x: h.x, y: h.y },
      pointerId: h.pointerId, width: Math.max(1,rect.width), height: Math.max(1,rect.height),
      offset: { x: Math.max(0,Math.min(h.downX-rect.left,rect.width)),
        y: Math.max(0,Math.min(h.downY-rect.top,rect.height)) },
      direction: 0, inFlight: false, lastIndex: swiper.activeIndex,
      expectedIndex: null, expectedDate: null,
    };
    sessionRef.current = s;
    updatePoint(h.pointerId, h.x, h.y);
  }, [cancel, swiperRef, updatePoint]);
  const moveDiary = React.useCallback((_: Point, nativeEvent?: Event | null) => {
    const h = heldRef.current;
    if (!h || !sessionRef.current) return false;
    if (nativeEvent && 'pointerId' in nativeEvent &&
        (nativeEvent as PointerEvent).pointerId === h.pointerId &&
        'clientX' in nativeEvent) {
      h.x = (nativeEvent as PointerEvent).clientX;
      h.y = (nativeEvent as PointerEvent).clientY;
    }
    updatePoint(h.pointerId, h.x, h.y);
    return sessionRef.current?.stage === 'external';
  }, [updatePoint]);
  const onNativeEnd = React.useCallback((kind: DiaryDragKind, id?: string) => {
    const key = kind === 'group' ? 'group' : `note:${id}`;
    if (suppressedEndRef.current === key) { suppressedEndRef.current = null; return true; }
    const s = sessionRef.current;
    if (!s || s.key !== key) return false;
    if (s.stage === 'external') {
      if (heldRef.current?.pointerId === s.pointerId) return true;
      finish(false);
      return true;
    }
    cancel();
    return false;
  }, [cancel, finish]);
  const onSlideChanged = React.useCallback((swiper: SwiperClass) => {
    const s = sessionRef.current;
    if (!s) return true;
    const expected = s.inFlight ? s.expectedIndex : s.lastIndex;
    if (expected !== null && swiper.activeIndex !== expected && !swiper.destroyed) {
      swiper.slideTo(expected, 0, false);
      return false;
    }
    return s.inFlight;
  }, []);
  const onSettled = React.useCallback((date: string, swiper: SwiperClass) => {
    if (!sessionRef.current) return true;
    settledRef.current(date, swiper);
    return false;
  }, []);
  const onWindowRebased = React.useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.stage !== 'external') return;
    window.requestAnimationFrame(() => {
      if (sessionRef.current !== s) return;
      const swiper = swiperRef.current;
      if (swiper && !swiper.destroyed && !s.inFlight) s.lastIndex = swiper.activeIndex;
      positionOverlay(s);
      project(s);
      if (s.direction && !s.inFlight && dwellRef.current === null)
        scheduleRef.current(EDGE_DWELL_MS);
    });
  }, [positionOverlay, project, swiperRef]);
  const overlay = carried && typeof document !== 'undefined' && createPortal(
    <div ref={node => { overlayRef.current = node; if (node && sessionRef.current) positionOverlay(sessionRef.current); }}
      data-cross-day-diary-overlay="true" aria-hidden="true" inert
      style={{ position: 'fixed', left: 0, top: 0, zIndex: 2100,
        width: carried.width, pointerEvents: 'none', willChange: 'transform' }}>
      <div className="flex items-start gap-2 rounded-lg bg-surfaceHighlight px-3 py-2 text-white shadow-xl">
        <BookOpenText size={18} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {carried.kind === 'group' ? `${carried.entries.length} diary entries`
              : (carried.entries[0]?.content.split('\n').find(line => line.trim()) || 'Diary entry')}
          </div>
          {carried.kind === 'note' && carried.entries[0]?.content && <div className="line-clamp-2 text-xs opacity-70">
            {carried.entries[0].content.slice(0, 140)}
          </div>}
        </div>
      </div>
    </div>, document.body);
  return { carried, projection: carried, overlay, start, moveDiary, onNativeEnd,
    onSlideChanged, onSettled, onWindowRebased, cancel };
}
