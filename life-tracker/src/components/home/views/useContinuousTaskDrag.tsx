import React from 'react';
import { createPortal } from 'react-dom';
import type { Swiper as SwiperClass } from 'swiper';
import { TOTAL_SLIDES } from './useDayViewSwiper';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import { TaskItem } from './TaskItem';
import { adjacentCalendarDate, clampTaskInsertIndex, dragEdgeDirection } from './crossDayTaskDrag';

const INITIAL_DWELL_MS = 410;
const REPEAT_COOLDOWN_MS = 330;
const MIN_TRANSITION_GUARD_MS = 350;

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };

interface Session {
  task: TaskDocument;
  sourceDate: string;
  settledDate: string;
  stage: 'native' | 'external';
  point: Point | null;
  pointerId: number | null;
  offset: Point;
  width: number;
  height: number;
  direction: -1 | 0 | 1;
  inFlight: boolean;
  lastSettledIndex: number;
  target: { categoryId: string; index: number };
}

export interface CarriedTask {
  task: TaskDocument;
  date: string;
  categoryId: string;
  index: number;
  height: number;
  x: number;
  y: number;
  width: number;
  offset: Point;
}

interface Options {
  isOpen: boolean;
  currentUserId: string;
  swiperRef: React.MutableRefObject<SwiperClass | null>;
  categories: CategoryDocument[];
  onCommit: (task: TaskDocument, date: string, categoryId: string, index: number) => Promise<void>;
  onFeedback: (message: string) => void;
  onExternalFinished: () => void;
}

const noop = () => undefined;

/**
 * Keeps only the carried drag outside Swiper. Normal same-day DnD remains
 * owned by TaskReorderRuntime until the FIRST edge advance. From then on,
 * pointer capture, overlay and final commit survive virtual-slide remounts.
 */
export function useContinuousTaskDrag({
  isOpen, currentUserId, swiperRef, categories, onCommit, onFeedback, onExternalFinished,
}: Options) {
  const sessionRef = React.useRef<Session | null>(null);
  const suppressedEndRef = React.useRef<string | null>(null);
  const dwellTimerRef = React.useRef<number | null>(null);
  const cooldownTimerRef = React.useRef<number | null>(null);
  const transitionTimerRef = React.useRef<number | null>(null);
  const [carried, setCarried] = React.useState<CarriedTask | null>(null);
  const [edgeHint, setEdgeHint] = React.useState<-1 | 0 | 1>(0);
  const latestRef = React.useRef({ isOpen, currentUserId, categories, onCommit, onFeedback, onExternalFinished });
  latestRef.current = { isOpen, currentUserId, categories, onCommit, onFeedback, onExternalFinished };

  const clearTimers = React.useCallback(() => {
    for (const timer of [dwellTimerRef, cooldownTimerRef, transitionTimerRef]) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    clearTimers();
    sessionRef.current = null;
    setCarried(null);
    setEdgeHint(0);
  }, [clearTimers]);

  const projectAtPointer = React.useCallback((session: Session) => {
    if (session.stage !== 'external' || session.inFlight) return;
    const swiper = swiperRef.current;
    const slide = swiper?.el?.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]');
    if (!slide || slide.dataset.dateStr !== session.settledDate) return;
    const taskCategory = latestRef.current.categories.some(category =>
      category.id === session.task.categoryId && category.userId === latestRef.current.currentUserId && !category.isDeleted)
      ? session.task.categoryId : latestRef.current.categories.find(category =>
        category.userId === latestRef.current.currentUserId && !category.isDeleted)?.id;
    if (!taskCategory) return;
    const pointer = session.point;
    const hit = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
    const categoryNode = hit instanceof Element &&
      slide.contains(hit) ? hit.closest<HTMLElement>('[data-task-category-id]') : null;
    const picked = categoryNode?.dataset.taskCategoryId;
    const valid = picked && latestRef.current.categories.some(category =>
      category.id === picked && !category.isDeleted && category.userId === latestRef.current.currentUserId);
    const categoryId = valid ? picked : taskCategory;
    const categoryEl = valid ? categoryNode : slide.querySelector<HTMLElement>(
      '[data-task-category-id="' + categoryId + '"]');
    const rows = categoryEl ? Array.from(categoryEl.querySelectorAll<HTMLElement>('[data-task-id]'))
      .filter(row => row.dataset.taskId !== session.task.id) : [];
    const index = pointer && valid ? rows.filter(row =>
      row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 < pointer.y).length : rows.length;
    session.target = { categoryId, index: clampTaskInsertIndex(index, rows.length) };
    const pos = pointer ?? { x: 0, y: 0 };
    setCarried({
      task: session.task, date: session.settledDate, ...session.target,
      height: session.height, width: session.width, offset: session.offset,
      x: pos.x, y: pos.y,
    });
  }, [swiperRef]);

  const advanceRef = React.useRef<() => void>(() => undefined);
  const scheduleRef = React.useRef<(delay: number) => void>(() => undefined);
  advanceRef.current = () => {
    dwellTimerRef.current = null;
    const session = sessionRef.current;
    const swiper = swiperRef.current;
    if (!session || !session.direction || session.inFlight ||
        !latestRef.current.isOpen || !swiper || swiper.destroyed || swiper.animating ||
        session.task.userId !== latestRef.current.currentUserId) return;
    // Never navigate into a virtual-window edge. Parent selectedDate rebases
    // the 181-slide window near ±87; retry only after Swiper is recentered.
    if (swiper.activeIndex <= 2 || swiper.activeIndex >= TOTAL_SLIDES - 3) {
      setEdgeHint(session.direction);
      return;
    }
    const edge = session.point ? dragEdgeDirection(
      session.point.x, session.point.y, swiper.el.getBoundingClientRect()) : 0;
    if (edge !== session.direction) return;
    const activeContent = swiper.el.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]');
    // Swiper virtual may be between windows or reanchoring; never advance an
    // unrendered day or a day that does not match the last settled target.
    if (!activeContent || activeContent.dataset.dateStr !== session.settledDate) return;
    if (session.stage === 'native') {
      session.stage = 'external';
      // Keep pointer routing on a stable element when Swiper removes the
      // original source slide. Never require the old DOM source after handoff.
      if (session.pointerId !== null) {
        try { document.body.setPointerCapture(session.pointerId); } catch { /* Unsupported pointer capture */ }
      }
      // Render outside Swiper before allowing its keyed source to unmount.
      projectAtPointer(session);
      const pos = session.point ?? { x: 0, y: 0 };
      setCarried({
        task: session.task, date: session.settledDate,
        ...session.target, height: session.height, width: session.width,
        offset: session.offset, x: pos.x, y: pos.y,
      });
    }
    session.inFlight = true;
    session.lastSettledIndex = swiper.activeIndex;
    const nextIndex = swiper.activeIndex + session.direction;
    swiper.slideTo(nextIndex);
    // Reduced-motion zero-duration swipes need the same settled handshake.
    if (swiper.params.speed === 0) {
      window.requestAnimationFrame(() => {
        if (sessionRef.current === session && session.inFlight) {
          onSettledRef.current(adjacentCalendarDate(session.settledDate, (nextIndex > session.lastSettledIndex ? 1 : -1)));

        }
      });
    }
    // A missing transition callback must fail closed, not spin forever.
    transitionTimerRef.current = window.setTimeout(() => {
      if (sessionRef.current === session && session.inFlight) {
        session.inFlight = false;
        // Restore the last settled day rather than displaying an undefined or
        // half-virtualized date. Do not advance again without a fresh edge move.
        if (!swiper.destroyed) swiper.slideTo(session.lastSettledIndex, 0);
        session.direction = 0; // Fail closed; never run blind repeated slides.
        setEdgeHint(0);
        latestRef.current.onFeedback('Day navigation paused. Move away and back to the edge.');
      }
    }, Math.max(MIN_TRANSITION_GUARD_MS, (swiper.params.speed || 0) + 300));
  };
  scheduleRef.current = (delay: number) => {
    if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = null;
    const session = sessionRef.current;
    if (!session || session.inFlight || !session.direction) return;
    dwellTimerRef.current = window.setTimeout(() => advanceRef.current(), delay);
  };

  const onSettledRef = React.useRef<(date: string) => void>(() => undefined);
  onSettledRef.current = (date: string) => {
    const session = sessionRef.current;
    if (!session || session.stage !== 'external' || !session.inFlight) return;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    session.inFlight = false;
    session.lastSettledIndex = swiperRef.current?.activeIndex ?? session.lastSettledIndex;
    session.settledDate = date;
    session.target = { categoryId: session.task.categoryId, index: Number.MAX_SAFE_INTEGER };
    window.requestAnimationFrame(() => {
      if (sessionRef.current !== session) return;
      projectAtPointer(session);
      if (cooldownTimerRef.current !== null) window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = window.setTimeout(() => {
        cooldownTimerRef.current = null;
        if (sessionRef.current === session) scheduleRef.current(INITIAL_DWELL_MS);
      }, REPEAT_COOLDOWN_MS);
    });
  };

  const updatePoint = React.useCallback((event: PointerEvent) => {
    const session = sessionRef.current;
    if (!session || (session.pointerId !== null && event.pointerId !== session.pointerId)) return;
    session.point = { x: event.clientX, y: event.clientY };
    const swiper = swiperRef.current;
    const rect = swiper?.el?.getBoundingClientRect();
    const next = rect ? dragEdgeDirection(event.clientX, event.clientY, rect) : 0;
    if (next !== session.direction) {
      session.direction = next;
      setEdgeHint(next);
      if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
      if (!session.inFlight && next) scheduleRef.current(INITIAL_DWELL_MS);
    }
    if (session.stage === 'external') projectAtPointer(session);
  }, [projectAtPointer, swiperRef]);

  const finish = React.useCallback((commit: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    const external = session.stage === 'external';
    if (external) suppressedEndRef.current = session.task.id;
    if (external && session.pointerId !== null) {
      try {
        if (document.body.hasPointerCapture(session.pointerId)) {
          document.body.releasePointerCapture(session.pointerId);
        }
      } catch { /* Pointer was already released */ }
    }
    // Store validated target before resetting the overlay.
    const target = { ...session.target };
    const date = session.settledDate;
    reset();
    if (external) latestRef.current.onExternalFinished();
    if (external && commit && session.task.userId === latestRef.current.currentUserId &&
        latestRef.current.isOpen && latestRef.current.categories.some(c =>
          c.id === target.categoryId && c.userId === latestRef.current.currentUserId && !c.isDeleted)) {
      void latestRef.current.onCommit(session.task, date, target.categoryId, target.index)
        .then(() => latestRef.current.onFeedback('Task moved to ' + date))
        .catch(() => latestRef.current.onFeedback('Could not move task. Please try again.'));
    }
  }, [reset]);

  React.useEffect(() => {
    if (!isOpen) { reset(); return; }
    const move = (event: PointerEvent) => updatePoint(event);
    const up = (event: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || (s.pointerId !== null && s.pointerId !== event.pointerId)) return;
      updatePoint(event);
      finish(true);
    };
    const cancel = (event: PointerEvent) => {
      const s = sessionRef.current;
      if (s && (s.pointerId === null || s.pointerId === event.pointerId)) finish(false);
    };
    const lost = () => finish(false);
    const onVisibility = () => { if (document.hidden) lost(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(false); };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', lost);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', key, true);
      reset();
    };
  }, [isOpen, finish, reset, updatePoint]);

  const startTask = React.useCallback((task: TaskDocument, rect: Rect, event?: Event | null) => {
    reset();
    if (!latestRef.current.isOpen || task.userId !== latestRef.current.currentUserId || !task.date) return;
    suppressedEndRef.current = null;
    const pointer = event && 'clientX' in event && 'clientY' in event
      ? { x: Number(event.clientX), y: Number(event.clientY) } : null;
    const pointerId = event && 'pointerId' in event ? Number(event.pointerId) : null;
    sessionRef.current = {
      task, sourceDate: task.date, settledDate: task.date, stage: 'native',
      point: pointer, pointerId, offset: {
        x: pointer ? pointer.x - rect.left : rect.width / 2,
        y: pointer ? pointer.y - rect.top : rect.height / 2,
      }, width: rect.width, height: rect.height,
      direction: 0, inFlight: false, lastSettledIndex: swiperRef.current?.activeIndex ?? 0,
      target: { categoryId: task.categoryId, index: Number.MAX_SAFE_INTEGER },
    };
    if (pointer) updatePoint({
      clientX: pointer.x, clientY: pointer.y,
      pointerId: pointerId ?? -1,
    } as PointerEvent);
  }, [reset, updatePoint]);

  const onNativeEnd = React.useCallback((taskId: string) => {
    if (suppressedEndRef.current === taskId) return true;
    const session = sessionRef.current;
    if (!session || session.task.id !== taskId) return false;
    if (session.stage === 'external') return true;
    reset();
    return false;
  }, [reset]);

  const onSettled = React.useCallback((date: string) => onSettledRef.current(date), []);
  const onWindowRebased = React.useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.stage !== 'external') return;
    window.requestAnimationFrame(() => {
      if (sessionRef.current === session) {
        projectAtPointer(session);
        if (session.direction && !session.inFlight && !dwellTimerRef.current) {
          scheduleRef.current(INITIAL_DWELL_MS);
        }
      }
    });
  }, [projectAtPointer]);

  const overlay = carried && createPortal(
    <div aria-hidden="true" data-cross-day-drag-overlay="true" style={{
      position: 'fixed', zIndex: 100, left: carried.x - carried.offset.x,
      top: carried.y - carried.offset.y, width: carried.width,
      pointerEvents: 'none',
    }}>
      <TaskItem task={carried.task}
        categoryColor={categories.find(c => c.id === carried.categoryId)?.color ?? '#6B7280'}
        currentUserId={currentUserId}
        onToggle={noop} onOpenActions={noop} onOpenMemo={noop}
        onEditStart={noop} onViewImage={noop}
        isEditing={false} editValue="" onEditChange={noop}
        onEditSave={noop} onEditCancel={noop}
        disableLayoutAnimation isDragOverlay />
    </div>, document.body);

  return {
    carried, edgeHint, overlay, startTask, onNativeEnd, onSettled,
    onWindowRebased, cancel: reset,
  };
}
