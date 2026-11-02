import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TourOutcome } from '../../lib/tourProgress';
import { positionTourGuide } from './tourPlacement';
import { CORE_TOUR_STEPS } from './tourSteps';
import './TourPlayer.css';

let nextTourGuardId = 0;
const SHEET_SURFACE = '[data-testid="day-sheet-swipe-surface"]';
function isDayViewOpen(): boolean {
  return Boolean(visibleTarget(SHEET_SURFACE) || visibleTarget('[data-testid="inline-day-view"]'));
}

export interface TourStep {
  title: string;
  detail: string;
  instruction?: string;
  target?: string;
}

interface TourTarget {
  element: HTMLElement;
  rect: DOMRect;
}

/** Never highlight an offscreen/hidden carousel slide or a control inside an inactive sheet. */
function visibleTarget(selector: string): TourTarget | null {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (!rect.width || !rect.height || rect.right <= 0 || rect.bottom <= 0 ||
      rect.left >= window.innerWidth || rect.top >= window.innerHeight ||
      element.closest('[aria-hidden="true"], [inert]')) continue;
    return { element, rect };
  }
  return null;
}

function findTarget(name?: string): TourTarget | null {
  const calendar = '[data-mosaic-tour="calendar"]';
  if (name === 'calendar') return visibleTarget(calendar + ' [aria-label="Next month"]');
  if (name === 'date') return visibleTarget(calendar + ' [data-calendar-day][aria-current="date"]') ??
    visibleTarget(calendar + ' [data-calendar-day]:not(:disabled)');
  if (name === 'dayview') return visibleTarget('[data-testid="day-sheet-swipe-surface"] [data-day-view-navigation="true"]') ??
    visibleTarget('[data-testid="inline-day-view"] [data-day-view-navigation="true"]') ??
    findTarget('date');
  if (name === 'menu') return visibleTarget('[data-home-menu-trigger="true"]');
  return null;
}

export function TourPlayer({ steps = CORE_TOUR_STEPS, onFinish }: {
  steps?: TourStep[];
  onFinish: (outcome: TourOutcome) => void;
}) {
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [targetAvailable, setTargetAvailable] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cardHeight, setCardHeight] = useState(218);
  const cardRef = useRef<HTMLElement>(null);
  const startFocus = useRef<HTMLElement | null>(null);
  const exitRef = useRef(onFinish);
  const finished = useRef(false);
  const guardIdRef = useRef<string | null>(null);
  const closeRef = useRef<((outcome: TourOutcome) => void) | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { exitRef.current = onFinish; }, [onFinish]);
  useEffect(() => {
    if (!guardIdRef.current) guardIdRef.current = `mosaic-tour-${++nextTourGuardId}`;
    const guardId = guardIdRef.current;
    const originalRoute = window.location.pathname + window.location.search;
    startFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    // StrictMode may set up this effect twice: never push duplicate history slots.
    if (window.history.state?.__mosaicTourGuard !== guardId) {
      window.history.pushState({ ...window.history.state, __mosaicTourGuard: guardId }, '');
    }
    const finish = (outcome: TourOutcome, popped = false) => {
      if (finished.current) return;
      finished.current = true;
      const state = window.history.state;
      if (!popped && state?.__mosaicTourGuard === guardId) {
        if (state.__mosaicBottomSheetGuard) {
          // Preserve any nested sheet and its Back behavior. A blind go(-2)
          // jumped outside the app when the user opened multiple panels.
          const nextState = { ...state };
          delete nextState.__mosaicTourGuard;
          window.history.replaceState(nextState, '');
        } else {
          window.history.back();
        }
      }
      exitRef.current(outcome);
    };
    const pop = (event: PopStateEvent) => {
      // Some embedded browsers emit popstate without state; read the active
      // history entry as a fallback before deciding whether a sheet closed.
      const state = event.state ?? window.history.state;
      if (state?.__mosaicTourGuard === guardId || state?.__mosaicBottomSheetGuard) return;
      finish('skipped', true);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish('skipped'); }
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', key, true);
    closeRef.current = finish;
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', key, true);
      // Route navigation is owned by the router. NEVER rewind history on
      // unmount: it previously redirected users away from their chosen page.
      if (!finished.current && window.location.pathname + window.location.search !== originalRoute) {
        finished.current = true;
        exitRef.current('skipped');
      }
      if (startFocus.current?.isConnected && !startFocus.current.closest('[inert]')) {
        startFocus.current.focus({ preventScroll: true });
      }
      closeRef.current = null;
    };
  }, []);

  const current = steps[index];
  const targetName = current?.target;
  const refresh = useCallback(() => {
    const target = findTarget(targetName);
    const rect = target?.rect ?? null;
    setTargetAvailable(available => available === Boolean(target) ? available : Boolean(target));
    const activeSheet = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
    setSheetOpen(previous => previous === activeSheet ? previous : activeSheet);
    setAnchor(previous => {
      if (!rect) return previous ? null : previous;
      if (previous && previous.left === rect.left && previous.top === rect.top &&
        previous.width === rect.width && previous.height === rect.height) return previous;
      return rect;
    });
    const cardWidth = cardRef.current?.getBoundingClientRect().width || Math.min(332, window.innerWidth - 24);
    const cardMeasuredHeight = cardRef.current?.getBoundingClientRect().height || cardHeight;
    const next = positionTourGuide(rect, { width: cardWidth, height: cardMeasuredHeight },
      { width: window.innerWidth, height: window.innerHeight });
    setPosition(previous => previous.left === next.left && previous.top === next.top ?
      previous : { left: next.left, top: next.top });
  }, [targetName, cardHeight]);

  useEffect(() => {
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['aria-hidden', 'hidden', 'inert'] });
    const sizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const next = cardRef.current?.getBoundingClientRect().height;
      if (next) setCardHeight(previous => previous === next ? previous : next);
      schedule();
    });
    if (cardRef.current) sizeObserver?.observe(cardRef.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver?.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [refresh]);

  // Advance only when Day View OPENS while this step is active. If users
  // already opened it, or press Back from the following step, do not skip
  // over the instructions or trap them in an automatic-forward loop.
  useEffect(() => {
    if (targetName !== 'date' || index >= steps.length - 1) return;
    let wasOpen = isDayViewOpen();
    let frame = 0;
    const check = () => {
      const open = isDayViewOpen();
      if (!wasOpen && open) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setIndex(i => i === index ? i + 1 : i));
      }
      wasOpen = open;
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['aria-hidden', 'hidden', 'inert'] });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [index, steps.length, targetName]);

  if (!current) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[120]" data-testid="mosaic-tour">
      {anchor ? (
        <div aria-hidden="true" className="mosaic-tour-highlight pointer-events-none fixed rounded-xl border-2 border-emerald-400"
          style={{
            left: anchor.left - 4, top: anchor.top - 4,
            width: anchor.width + 8, height: anchor.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,.28)',
          }} />
      ) : <div className="pointer-events-none fixed inset-0 bg-black/20" aria-hidden="true" />}
      <section ref={cardRef} role="dialog" aria-modal="false" aria-label="Mosaic guided tour"
        className="mosaic-tour-card pointer-events-auto fixed w-[calc(100%-24px)] max-w-[332px] rounded-2xl border border-[#414141] bg-[#191919] px-4 py-4 text-white shadow-2xl"
        style={{ left: position.left, top: position.top, maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto' }}>
        <div key={index} className="mosaic-tour-step">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-emerald-400">TIP {index + 1} OF {steps.length}</p>
            <button type="button" onClick={() => closeRef.current?.('skipped')}
              className="rounded-md px-2 py-1 text-xs text-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Skip tour</button>
          </div>
          <h2 ref={titleRef} tabIndex={-1} className="mb-1 text-base font-semibold outline-none">{current.title}</h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-300">{current.detail}</p>
          {current.instruction && (
            <p role="status" aria-live="polite" className="mb-3 rounded-lg bg-[#2A2A2A] p-2.5 text-sm leading-relaxed text-white">
              {targetAvailable ? current.instruction
                : current.target === 'date' && sheetOpen ? 'Day View is already open. Tap Next to continue, or close it to choose another day.'
                : current.target === 'dayview' ? 'Return to the calendar and open a date to explore Day View. Or tap Next to continue.'
                : current.target === 'menu' && sheetOpen ? 'You opened a panel. Explore it freely, or close it to find the menu. Next still works.'
                : 'You can explore in any order. Return to the calendar to try this tip, or tap Next.'}
            </p>
          )}
        </div>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-[#333]" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: ((index + 1) / steps.length * 100) + '%' }} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {index > 0 && !targetAvailable && <button type="button" onClick={() => setIndex(0)}
            className="rounded-lg border border-[#555] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Start over</button>}
          {index > 0 && <button type="button" onClick={() => setIndex(i => i - 1)}
            className="rounded-lg border border-[#555] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Back</button>}
          <button type="button" onClick={() => index === steps.length - 1 ? closeRef.current?.('completed') : setIndex(i => i + 1)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
            {index === steps.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </section>
    </div>, document.body
  );
}
