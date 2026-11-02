import React from 'react';
import { createPortal } from 'react-dom';
import type { Swiper as SwiperClass } from 'swiper';
import { TOTAL_SLIDES } from './useDayViewSwiper';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import { TaskItem } from './TaskItem';
import { adjacentCalendarDate, clampTaskInsertIndex, dragEdgeDirection } from './crossDayTaskDrag';

const INITIAL_DWELL_MS = 320;
const REPEAT_COOLDOWN_MS = 230;
const MIN_TRANSITION_GUARD_MS = 350;

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };

interface HeldPointer {
  id: number;
  pointerType: string;
  taskId: string;
  x: number;
  y: number;
  downX: number;
  downY: number;
  touchId: number | null;
}

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
  expectedIndex: number | null;
  expectedDate: string | null;
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
  // Only real, primary pointerdown events on the owned task can arm a
  // cross-day session. dnd-kit drag coordinates alone aren't proof of a hold.
  const heldRef = React.useRef<HeldPointer | null>(null);
  const suppressedEndRef = React.useRef<string | null>(null);
  const dwellTimerRef = React.useRef<number | null>(null);
  const cooldownTimerRef = React.useRef<number | null>(null);
  const transitionTimerRef = React.useRef<number | null>(null);
  const projectionFrameRef = React.useRef<number | null>(null);
  const [carried, setCarried] = React.useState<CarriedTask | null>(null);
  // Hold the neutral insertion slot until the persisted row can replace it.
  // The overlay itself is removed immediately on release.
  const [settling, setSettling] = React.useState<CarriedTask | null>(null);
  const settleRevisionRef = React.useRef(0);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const latestRef = React.useRef({ isOpen, currentUserId, categories, onCommit, onFeedback, onExternalFinished });

  const clearTimers = React.useCallback(() => {
    for (const timer of [dwellTimerRef, cooldownTimerRef, transitionTimerRef]) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    clearTimers();
    if (projectionFrameRef.current !== null) {
      cancelAnimationFrame(projectionFrameRef.current);
      projectionFrameRef.current = null;
    }
    sessionRef.current = null;
    setCarried(null);
  }, [clearTimers]);

  // Position on a compositor layer: never re-render 181 logical slides for
  // every phone touchmove, including movements during a slide animation.
  const positionOverlay = React.useCallback((session: Session) => {
    const point = session.point;
    if (!point || !overlayRef.current) return;
    overlayRef.current.style.transform =
      `translate3d(${point.x - session.offset.x}px, ${point.y - session.offset.y}px, 0)`;
  }, []);
  const attachOverlay = React.useCallback((node: HTMLDivElement | null) => {
    overlayRef.current = node;
    const session = sessionRef.current;
    if (node && session) positionOverlay(session);
    // Do NOT recapture touch on the newly mounted overlay. Reassigning a
    // finger's pointer capture mid-gesture races the native touch pointer
    // lifecycle on WebKit and can cancel the source drag.
  }, [positionOverlay]);

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
    // A held finger may rest OUTSIDE the horizontal sheet edge to keep
    // navigating days. Sample inside the active viewport at that same Y so
    // vertical category targeting still works without forcing a return inward.
    const bounds = slide.getBoundingClientRect();
    const hitX = pointer
      ? Math.max(bounds.left + 8, Math.min(pointer.x, bounds.right - 8))
      : 0;
    const hit = pointer ? document.elementFromPoint(hitX, pointer.y) : null;
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
    // A neutral reserved slot moves its neighboring rows. Without a stable
    // zone around that slot, each rerender would move the row midpoints and
    // switch its own insertion index back and forth under a stationary finger.
    const currentSlot = categoryId === session.target.categoryId
      ? categoryEl?.querySelector<HTMLElement>('[data-cross-day-reorder-slot]')
      : null;
    const slotRect = currentSlot?.getBoundingClientRect();
    const keepSlot = Boolean(pointer && slotRect &&
      pointer.y >= slotRect.top - 10 && pointer.y <= slotRect.bottom + 10);
    const index = keepSlot ? session.target.index : pointer && valid ? rows.filter(row =>
      row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 < pointer.y).length : rows.length;
    session.target = { categoryId, index: clampTaskInsertIndex(index, rows.length) };
    const pos = pointer ?? { x: 0, y: 0 };
    setCarried(current => current && current.date === session.settledDate &&
      current.categoryId === session.target.categoryId &&
      current.index === session.target.index ? current : {
        task: session.task, date: session.settledDate, ...session.target,
        height: session.height, width: session.width, offset: session.offset,
        x: pos.x, y: pos.y,
      });
  }, [swiperRef]);

  const queueProjection = React.useCallback((session: Session) => {
    // Use at most one layout measurement and destination React update per
    // animation frame. Overlay position itself still follows every touch
    // synchronously, even if rendering the list takes longer on a phone.
    if (projectionFrameRef.current !== null) return;
    projectionFrameRef.current = requestAnimationFrame(() => {
      projectionFrameRef.current = null;
      if (sessionRef.current === session && !session.inFlight) projectAtPointer(session);
    });
  }, [projectAtPointer]);

  const advanceRef = React.useRef<() => void>(() => undefined);
  const scheduleRef = React.useRef<(delay: number) => void>(() => undefined);
  const onSettledRef = React.useRef<(date: string, swiper: SwiperClass) => boolean>(() => false);
  React.useLayoutEffect(() => {
    latestRef.current = { isOpen, currentUserId, categories, onCommit, onFeedback, onExternalFinished };
    advanceRef.current = () => {
    dwellTimerRef.current = null;
    const session = sessionRef.current;
    const swiper = swiperRef.current;
    if (!session || !heldRef.current ||
        heldRef.current.id !== session.pointerId ||
        !session.direction || session.inFlight ||
        !latestRef.current.isOpen || !swiper || swiper.destroyed || swiper.animating ||
        session.task.userId !== latestRef.current.currentUserId) return;
    // Never navigate into a virtual-window edge. Parent selectedDate rebases
    // the 181-slide window near ±87; retry only after Swiper is recentered.
    if (swiper.activeIndex <= 2 || swiper.activeIndex >= TOTAL_SLIDES - 3) return;
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
    session.expectedIndex = nextIndex;
    session.expectedDate = adjacentCalendarDate(session.settledDate, session.direction);
    swiper.slideTo(nextIndex);
    // Reduced-motion zero-duration swipes need the same settled handshake.
    if (swiper.params.speed === 0) {
      window.requestAnimationFrame(() => {
        if (sessionRef.current === session && session.inFlight) {
          onSettledRef.current(session.expectedDate ?? session.settledDate, swiper);
        }
      });
    }
    // A missing transition callback must not undo an already-rendered target.
    // Swiper FreeMode can settle its slide without emitting transitionEnd.
    // Accept only the exact expected index AND its materialized date; never
    // advance blindly or confirm a half-virtualized slide.
    transitionTimerRef.current = window.setTimeout(() => {
      if (sessionRef.current === session && session.inFlight) {
        const content = !swiper.destroyed
          ? swiper.el.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]')
          : null;
        if (!swiper.destroyed && swiper.activeIndex === session.expectedIndex &&
            content?.dataset.dateStr === session.expectedDate &&
            onSettledRef.current(session.expectedDate, swiper)) {
          return;
        }
        session.inFlight = false;
        session.expectedIndex = null;
        session.expectedDate = null;
        // Restore the last settled day rather than displaying an undefined or
        // half-virtualized date. Do not advance again without a fresh edge move.
        if (!swiper.destroyed) swiper.slideTo(session.lastSettledIndex, 0, false);
        session.direction = 0; // Fail closed; never run blind repeated slides.
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

  onSettledRef.current = (date: string, swiper: SwiperClass) => {
    const session = sessionRef.current;
    if (!session || session.stage !== 'external' || !session.inFlight ||
        swiper !== swiperRef.current || swiper.destroyed ||
        swiper.activeIndex !== session.expectedIndex ||
        date !== session.expectedDate) return false;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    session.inFlight = false;
    session.lastSettledIndex = swiper.activeIndex;
    session.expectedIndex = null;
    session.expectedDate = null;
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
    return true;
  };
  }, [isOpen, currentUserId, categories, onCommit, onFeedback, onExternalFinished, projectAtPointer, swiperRef]);

  const updatePoint = React.useCallback((event: PointerEvent) => {
    const session = sessionRef.current;
    if (!session || (session.pointerId !== null && event.pointerId !== session.pointerId)) return;
    session.point = { x: event.clientX, y: event.clientY };
    if (session.stage === 'external') positionOverlay(session);
    const swiper = swiperRef.current;
    const rect = swiper?.el?.getBoundingClientRect();
    const next = rect ? dragEdgeDirection(event.clientX, event.clientY, rect) : 0;
    if (next !== session.direction) {
      session.direction = next;
      if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
      if (!session.inFlight && next) scheduleRef.current(INITIAL_DWELL_MS);
    }
    if (session.stage === 'external' && !session.inFlight) queueProjection(session);
  }, [positionOverlay, queueProjection, swiperRef]);

  const finish = React.useCallback((commit: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    const external = session.stage === 'external';
    if (external) suppressedEndRef.current = session.task.id;
    // Releasing mid-transition commits the last *settled* day. Without
    // restoring its rendered index, an abandoned touch swipe can complete
    // after cleanup and appear to teleport the Day View several dates.
    const swiper = swiperRef.current;
    if (session.inFlight && swiper && !swiper.destroyed) {
      swiper.slideTo(session.lastSettledIndex, 0, false);
    }
    if (external && session.pointerId !== null) {
      try {
        if (document.body.hasPointerCapture(session.pointerId)) {
          document.body.releasePointerCapture(session.pointerId);
        }
      } catch { /* Pointer already released/canceled */ }
    }
    // Store validated target before resetting the overlay.
    const target = { ...session.target };
    const date = session.settledDate;
    const accepted = external && commit && session.task.userId === latestRef.current.currentUserId &&
      latestRef.current.isOpen && latestRef.current.categories.some(c =>
        c.id === target.categoryId && c.userId === latestRef.current.currentUserId && !c.isDeleted);
    const revision = ++settleRevisionRef.current;
    // End all edge timers and release the floating overlay synchronously
    // with the physical pointer release, never after an async data write.
    reset();
    if (accepted) {
      const point = session.point ?? { x: 0, y: 0 };
      setSettling({ task: session.task, date, ...target, height: session.height,
        width: session.width, offset: session.offset, x: point.x, y: point.y });
    }
    if (external) latestRef.current.onExternalFinished();
    if (accepted) {
      const clearSettling = () => {
        if (settleRevisionRef.current === revision) setSettling(null);
      };
      // An unresponsive storage write must not leave a permanent slot.
      const safetyTimeout = window.setTimeout(clearSettling, 2500);
      void Promise.resolve().then(() =>
        latestRef.current.onCommit(session.task, date, target.categoryId, target.index)
      ).catch(() => latestRef.current.onFeedback('Could not move task. Please try again.'))
        .finally(() => {
          // The database view needs a render frame to replace the neutral
          // slot with the destination row. Don't animate both at once.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.clearTimeout(safetyTimeout);
            clearSettling();
          }));
        });
    }
  }, [reset]);

  React.useEffect(() => {
    if (!isOpen) {
      heldRef.current = null;
      settleRevisionRef.current += 1;
      // Avoid a synchronous state cascade during sheet-close effects.
      const frame = window.requestAnimationFrame(() => setSettling(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.isPrimary === false ||
          ((event.pointerType === 'mouse' || event.pointerType === 'pen') &&
            (event.buttons & 1) === 0)) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-task-id]') : null;
      const viewport = swiperRef.current?.el;
      // Exclude category, memo, checkbox, shared cards, and inactive slides.
      if (!target || !viewport?.contains(target) ||
          !target.closest('.swiper-slide-active')) return;
      const taskId = target.dataset.taskId;
      if (!taskId) return;
      heldRef.current = {
        id: event.pointerId, pointerType: event.pointerType,
        taskId, x: event.clientX, y: event.clientY,
        downX: event.clientX, downY: event.clientY, touchId: null,
      };
    };
    const move = (event: PointerEvent) => {
      const held = heldRef.current;
      if (!held || event.pointerId !== held.id) return;
      if ((held.pointerType === 'mouse' || held.pointerType === 'pen') &&
          (event.buttons & 1) === 0) {
        // Missing pointerup/lost capture: no mouse button means no drag.
        heldRef.current = null;
        finish(false);
        return;
      }
      held.x = event.clientX;
      held.y = event.clientY;
      updatePoint(event);
    };
    const up = (event: PointerEvent) => {
      if (heldRef.current?.id !== event.pointerId) return;
      const s = sessionRef.current;
      // Pointerup means the finger is physically lifted. Never ignore it
      // while waiting for touchend: WebKit may dispatch the latter only to
      // a detached source subtree after an edge swipe.
      if (s?.pointerId === event.pointerId) {
        if (s.stage === 'external') updatePoint(event);
        heldRef.current = null;
        finish(true);
      } else {
        heldRef.current = null;
      }
      detachSourceTouch();
    };
    const cancel = (event: PointerEvent) => {
      if (heldRef.current?.id !== event.pointerId) return;
      // Pointercancel alone is not a complete touch lifecycle. A source
      // slide disappearing or native pan arbitration can cancel PointerEvents
      // while the same Touch identifier is still actively moving.
      if (heldRef.current.pointerType === 'touch' &&
          sessionRef.current?.stage === 'external' &&
          heldRef.current.touchId !== null) return;
      heldRef.current = null;
      finish(false);
    };
    // Some desktop drag paths lose pointerup but deliver mouseup. It must
    // release our hold and stop any pending repeat before the next mousemove.
    const mouseUp = (event: MouseEvent) => {
      if (event.button !== 0 || heldRef.current?.pointerType !== 'mouse') return;
      heldRef.current = null;
      finish(true);
    };
    // Native TouchEvents remain targeted at their ORIGINAL touched element.
    // Swiper may detach that row during a cross-day handoff; events no longer
    // bubble through window then. Retain direct listeners on that source
    // element until this single-finger gesture actually terminates.
    let sourceTouchTarget: HTMLElement | null = null;
    const detachSourceTouch = () => {
      if (!sourceTouchTarget) return;
      sourceTouchTarget.removeEventListener('touchmove', touchMove, true);
      sourceTouchTarget.removeEventListener('touchend', touchEnd, true);
      sourceTouchTarget.removeEventListener('touchcancel', touchCancel, true);
      sourceTouchTarget = null;
    };
    // The task title deliberately permits pan-y for *pre*-long-press
    // scrolling. After dnd-kit lifts the task, that same native pan can
    // intermittently steal a finger and cancel pointer events on mobile.
    // Prevent native scrolling only for the active owner drag, not taps or
    // unactivated touch swipes. Also use TouchEvents as a backup stream if
    // a virtual slide removes the source/its implicit pointer capture.
    const touchStart = (event: TouchEvent) => {
      const held = heldRef.current;
      if (held?.pointerType !== 'touch') return;
      if (sessionRef.current && event.touches.length !== 1) {
        heldRef.current = null;
        finish(false);
        return;
      }
      if (event.touches.length === 1 && held.touchId === null) {
        held.touchId = event.touches[0].identifier;
      }
      if (!sourceTouchTarget && event.target instanceof Element) {
        // Touch target may be a nested SVG or span. Attach to its stable
        // HTML task ancestor so TouchEvent overloads and detached bubbling
        // both work when Swiper unmounts the source slide.
        sourceTouchTarget = event.target.closest<HTMLElement>('[data-task-id]');
        sourceTouchTarget?.addEventListener('touchmove', touchMove, { capture: true, passive: false });
        sourceTouchTarget?.addEventListener('touchend', touchEnd, true);
        sourceTouchTarget?.addEventListener('touchcancel', touchCancel, true);
      }
    };
    const touchMove = (event: TouchEvent) => {
      const held = heldRef.current;
      const session = sessionRef.current;
      if (held?.pointerType !== 'touch' || !session ||
          session.pointerId !== held.id || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (held.touchId !== null && touch.identifier !== held.touchId) return;
      if (held.touchId === null) held.touchId = touch.identifier;
      // dnd-kit already owns the source before handoff. Only intercept
      // scrolling once our persistent cross-day overlay owns the touch.
      if (session.stage !== 'external') return;
      if (event.cancelable) event.preventDefault();
      held.x = touch.clientX;
      held.y = touch.clientY;
      updatePoint({pointerId: held.id, clientX: touch.clientX, clientY: touch.clientY} as PointerEvent);
    };
    const touchEnd = (event: TouchEvent) => {
      const held = heldRef.current;
      if (held?.pointerType !== 'touch' || event.touches.length !== 0) return;
      if (held.touchId !== null && !Array.from(event.changedTouches)
        .some(touch => touch.identifier === held.touchId)) return;
      const last = Array.from(event.changedTouches).find(touch =>
        held.touchId === null || touch.identifier === held.touchId);
      if (last && sessionRef.current?.stage === 'external') {
        held.x = last.clientX;
        held.y = last.clientY;
        updatePoint({pointerId: held.id, clientX: held.x, clientY: held.y} as PointerEvent);
      }
      heldRef.current = null;
      detachSourceTouch();
      finish(true);
    };
    const touchCancel = (event: TouchEvent) => {
      const held = heldRef.current;
      if (held?.pointerType !== 'touch' || !sessionRef.current) return;
      if (held.touchId !== null && !Array.from(event.changedTouches)
        .some(touch => touch.identifier === held.touchId)) return;
      heldRef.current = null;
      detachSourceTouch();
      finish(false);
    };
    const lost = () => {
      heldRef.current = null;
      detachSourceTouch();
      finish(false);
    };
    const onVisibility = () => { if (document.hidden) lost(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        heldRef.current = null;
        detachSourceTouch();
        finish(false);
      }
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('mouseup', mouseUp, true);
    window.addEventListener('touchstart', touchStart, true);
    window.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    window.addEventListener('touchend', touchEnd, true);
    window.addEventListener('touchcancel', touchCancel, true);
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('mouseup', mouseUp, true);
      window.removeEventListener('touchstart', touchStart, true);
      window.removeEventListener('touchmove', touchMove, true);
      window.removeEventListener('touchend', touchEnd, true);
      window.removeEventListener('touchcancel', touchCancel, true);
      detachSourceTouch();
      window.removeEventListener('blur', lost);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', key, true);
      heldRef.current = null;
      reset();
    };
  }, [isOpen, finish, reset, updatePoint, swiperRef]);

  // The dnd-kit operation position is the draggable's position, NOT a
  // trustworthy cursor/client coordinate. Only feed real pointer movement
  // associated with the held pointer; stale sensor moves cannot navigate days.
  const moveTask = React.useCallback((_position: Point, event?: Event | null) => {
    const session = sessionRef.current;
    const held = heldRef.current;
    if (!session || !held || session.pointerId !== held.id) return;
    if (event && 'pointerId' in event && Number(event.pointerId) === held.id &&
        'clientX' in event && 'clientY' in event) {
      const pointer = event as PointerEvent;
      if ((held.pointerType === 'mouse' || held.pointerType === 'pen') &&
          (pointer.buttons & 1) === 0) {
        heldRef.current = null;
        finish(false);
        return;
      }
      held.x = pointer.clientX;
      held.y = pointer.clientY;
    }
    updatePoint({
      clientX: held.x, clientY: held.y, pointerId: held.id,
    } as PointerEvent);
  }, [finish, updatePoint]);

  const startTask = React.useCallback((task: TaskDocument, rect: Rect) => {
    const held = heldRef.current;
    if (!held || held.taskId !== task.id ||
        !latestRef.current.isOpen || task.userId !== latestRef.current.currentUserId ||
        !task.date) {
      reset();
      return;
    }
    reset();
    settleRevisionRef.current += 1;
    setSettling(null);
    suppressedEndRef.current = null;
    // Swiper may have started its own gesture on the original pointerdown,
    // before dnd-kit's long-press sensor activated. Retire only that native
    // gesture: the active task now owns this pointer until release.
    const swiper = swiperRef.current;
    if (swiper && !swiper.destroyed) {
      swiper.touchEventsData.isTouched = false;
      swiper.touchEventsData.isMoved = false;
      swiper.touchEventsData.startMoving = false;
    }
    sessionRef.current = {
      task, sourceDate: task.date, settledDate: task.date, stage: 'native',
      point: { x: held.x, y: held.y }, pointerId: held.id,
      // Source rect can drift during the 500 ms long press if the page was
      // still settling. Never anchor an overlay outside its grabbed row.
      offset: {
        x: Math.max(0, Math.min(held.downX - rect.left, rect.width)),
        y: Math.max(0, Math.min(held.downY - rect.top, rect.height)),
      },
      width: rect.width, height: rect.height,
      direction: 0, inFlight: false, lastSettledIndex: swiperRef.current?.activeIndex ?? 0,
      expectedIndex: null, expectedDate: null,
      target: { categoryId: task.categoryId, index: Number.MAX_SAFE_INTEGER },
    };
    updatePoint({
      clientX: held.x, clientY: held.y, pointerId: held.id,
    } as PointerEvent);
  }, [reset, updatePoint, swiperRef]);

  const onNativeEnd = React.useCallback((taskId: string) => {
    if (suppressedEndRef.current === taskId) {
      suppressedEndRef.current = null;
      return true;
    }
    const session = sessionRef.current;
    if (!session || session.task.id !== taskId) return false;
    if (session.stage === 'external') {
      // Swiper replaces the native draggable source when advancing days.
      // dnd-kit consequently reports a canceled local drag *while the
      // physical pointer is still down*. That is a handoff, not a release.
      // The stable window pointerup/cancel/mouseup listeners own final commit.
      if (heldRef.current?.id === session.pointerId) return true;
      finish(false);
      return true;
    }
    heldRef.current = null;
    reset();
    return false;
  }, [finish, reset]);

  const onSettled = React.useCallback((date: string, swiper: SwiperClass) => {
    if (swiper.destroyed || swiper !== swiperRef.current) return false;
    if (!sessionRef.current) return true;
    return onSettledRef.current(date, swiper);
  }, []);
  const onSlideChanged = React.useCallback((swiper: SwiperClass) => {
    if (swiper.destroyed || swiper !== swiperRef.current) return false;
    const session = sessionRef.current;
    if (!session) return true;
    const expected = session.inFlight ? session.expectedIndex : session.lastSettledIndex;
    if (expected !== null && swiper.activeIndex !== expected && !swiper.destroyed) {
      // Block native Swiper momentum from jumping extra dates during a held drag.
      swiper.slideTo(expected, 0, false);
      return false;
    }
    return session.inFlight;
  }, []);
  const onWindowRebased = React.useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.stage !== 'external' ||
        heldRef.current?.id !== session.pointerId) return;
    window.requestAnimationFrame(() => {
      if (sessionRef.current === session) {
        const swiper = swiperRef.current;
        // A virtual-window rebase mounts a new Swiper centered at index 90.
        if (swiper && !swiper.destroyed && !session.inFlight) {
          session.lastSettledIndex = swiper.activeIndex;
        }
        positionOverlay(session);
        projectAtPointer(session);
        if (session.direction && !session.inFlight && !dwellTimerRef.current) {
          scheduleRef.current(INITIAL_DWELL_MS);
        }
      }
    });
  }, [positionOverlay, projectAtPointer, swiperRef]);

  const overlay = carried && createPortal(
    <div ref={attachOverlay} aria-hidden="true" data-cross-day-drag-overlay="true" style={{
      position: 'fixed', zIndex: 100, left: 0, top: 0, width: carried.width,
      pointerEvents: 'none', willChange: 'transform',
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
    carried, projection: carried ?? settling, overlay, startTask, moveTask, onNativeEnd, onSettled,
    onSlideChanged, onWindowRebased, cancel: reset,
  };
}
