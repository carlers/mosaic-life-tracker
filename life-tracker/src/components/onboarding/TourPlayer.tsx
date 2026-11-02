import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TourOutcome } from '../../lib/tourProgress';
import { CORE_TOUR_STEPS } from './tourSteps';

export interface TourStep {
  title: string;
  detail: string;
  target?: string;
}

export function TourPlayer({ steps = CORE_TOUR_STEPS, onFinish }: {
  steps?: TourStep[];
  onFinish: (outcome: TourOutcome) => void;
}) {
  const [index, setIndex] = useState(0);
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const startFocus = useRef<HTMLElement | null>(null);
  const exitRef = useRef(onFinish);
  useEffect(() => { exitRef.current = onFinish; }, [onFinish]);
  const finished = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    startFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    // A history entry makes Android/system Back dismiss the tour before navigating away.
    window.history.pushState({ ...window.history.state, mosaicTourOpen: true }, '');
    const finish = (outcome: TourOutcome, popped = false) => {
      if (finished.current) return;
      finished.current = true;
      if (!popped && window.history.state?.mosaicTourOpen) window.history.back();
      exitRef.current(outcome);
    };
    const pop = () => finish('skipped', true);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish('skipped'); }
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', key, true);
    // Buttons use the same exit contract.
    const api = { finish };
    closeRef.current = api.finish;
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', key, true);
      if (!finished.current && window.history.state?.mosaicTourOpen) window.history.back();
      startFocus.current?.focus();
      closeRef.current = null;
    };
  }, []);

  const closeRef = useRef<((outcome: TourOutcome) => void) | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const anchor = steps[index]?.target;
      const selector = anchor === 'menu' ? '[data-home-menu-trigger="true"]' :
        anchor === 'dayview' ? '[data-testid="day-sheet-swipe-surface"]' :
        '[data-mosaic-tour="calendar"]';
      const element = anchor ? document.querySelector(selector) : null;
      if (element instanceof HTMLElement) {
        const rect = element.getBoundingClientRect();
        setHighlight(previous => {
          if (!rect.width || !rect.height) return null;
          if (previous && previous.left === rect.left && previous.top === rect.top &&
              previous.width === rect.width && previous.height === rect.height) return previous;
          return rect;
        });
      } else setHighlight(previous => previous ? null : previous);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [index, steps]);

  useEffect(() => { titleRef.current?.focus(); }, [index]);
  const current = steps[index];
  if (!current) return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] pointer-events-none" data-testid="mosaic-tour">
      {highlight && <div aria-hidden="true" className="fixed rounded-lg border-2 border-emerald-400"
        style={{ left: Math.max(0, highlight.left - 3), top: Math.max(0, highlight.top - 3),
          width: highlight.width + 6, height: highlight.height + 6,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.44)' }} />}
      {!highlight && <div className="fixed inset-0 bg-black/45" aria-hidden="true" />}
      <section role="dialog" aria-modal="false" aria-label="Mosaic guided tour"
        className="pointer-events-auto absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[#414141] bg-[#191919] p-5 text-white shadow-2xl">
        <p className="mb-2 text-xs font-medium text-emerald-400">MOSAIC TOUR · {index + 1} OF {steps.length}</p>
        <h2 ref={titleRef} tabIndex={-1} className="mb-2 text-lg font-semibold outline-none">{current.title}</h2>
        <p className="mb-5 text-sm leading-relaxed text-gray-300">{current.detail}</p>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => closeRef.current?.('skipped')}
            className="rounded-lg px-2 py-2 text-sm text-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Skip tour</button>
          <div className="flex gap-2">
            {index > 0 && <button type="button" onClick={() => setIndex(i => i - 1)}
              className="rounded-lg border border-[#555] px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Back</button>}
            <button type="button" onClick={() => index === steps.length - 1 ? closeRef.current?.('completed') : setIndex(i => i + 1)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
              {index === steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>, document.body);
}
