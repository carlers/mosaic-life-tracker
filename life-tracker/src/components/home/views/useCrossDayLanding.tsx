import React from 'react';
import { createPortal } from 'react-dom';
import type { Swiper as SwiperClass } from 'swiper';

const LANDING_DURATION_MS = 210;
const REVEAL_DURATION_MS = 115;
const DESTINATION_WAIT_MS = 1300;
const WRITE_GUARD_MS = 3500;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export type CrossDayLandingTarget = {
  date: string;
  kind: 'task' | 'note' | 'group';
  id: string;
};
type Landing<T> = {
  snapshot: T;
  target: CrossDayLandingTarget;
  phase: 'pending' | 'reveal';
};
type Begin<T> = {
  snapshot: T;
  target: CrossDayLandingTarget;
  commit: () => Promise<void>;
  releaseSlot: () => void;
  onError: (error: unknown) => void;
};

function attr(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function activeSlide(swiper: SwiperClass | null, date: string) {
  const node = swiper?.destroyed ? null :
    swiper?.el?.querySelector<HTMLElement>('.swiper-slide-active [data-date-str]');
  return node?.dataset.dateStr === date ? node : null;
}
function landingElement(swiper: SwiperClass | null, target: CrossDayLandingTarget) {
  const slide = activeSlide(swiper, target.date);
  if (!slide) return null;
  const id = attr(target.id);
  if (target.kind === 'task') return slide.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
  if (target.kind === 'note') return slide.querySelector<HTMLElement>(
    `[data-diary-note-row="${id}"], [data-diary-reorder-id="${id}"]`);
  // A group may merge with a pre-existing destination group. Never hide or
  // displace the destination's existing entries merely to land the overlay.
  return slide.querySelector<HTMLElement>(
    '[data-diary-drag-heading], [data-diary-drag-group], [data-testid="diary-day-group"], [data-testid="diary-day-card"]');
}
function landingSlot(swiper: SwiperClass | null, target: CrossDayLandingTarget) {
  if (target.kind === 'group') return landingElement(swiper, target);
  return activeSlide(swiper, target.date)?.querySelector<HTMLElement>(
    '[data-cross-day-reorder-slot]') ?? null;
}
function moveOverlay(overlay: HTMLElement, target: HTMLElement, duration: number) {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  overlay.style.transition = `transform ${duration}ms ${EASING}, width ${duration}ms ${EASING}`;
  overlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
  overlay.style.width = `${rect.width}px`;
  return true;
}

/**
 * One drop-release animator for task, Diary note, and Diary group edge drags.
 * The source portal stays mounted after pointerup. Its projected slot remains
 * until the local-first commit resolves; the real row is hidden while the
 * portal glides into its measured final position, then revealed underneath.
 *
 * No per-pointer-move work, data mutations, or extra slide renders.
 */
export function useCrossDayLanding<T>(
  isOpen: boolean,
  ownerId: string,
  swiperRef: React.MutableRefObject<SwiperClass | null>,
  overlayRef: React.MutableRefObject<HTMLDivElement | null>,
) {
  const [landing, setLanding] = React.useState<Landing<T> | null>(null);
  const revisionRef = React.useRef(0);
  const ownerRef = React.useRef(ownerId);
  const latestRef = React.useRef({ isOpen, ownerId });
  React.useLayoutEffect(() => {
    latestRef.current = { isOpen, ownerId };
  });
  const cancel = React.useCallback(() => {
    revisionRef.current += 1;
    if (overlayRef.current) {
      overlayRef.current.style.transition = '';
      overlayRef.current.style.opacity = '';
    }
    setLanding(null);
  }, [overlayRef]);
  React.useEffect(() => {
    if (isOpen && ownerRef.current === ownerId) return;
    ownerRef.current = ownerId;
    // Render immediately excludes the previous owner; this retires timers
    // after render without writing state synchronously inside an effect.
    const frame = window.requestAnimationFrame(cancel);
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, ownerId, cancel]);
  React.useEffect(() => () => { revisionRef.current += 1; }, []);

  const begin = React.useCallback((args: Begin<T>) => {
    const { snapshot, target, commit, releaseSlot, onError } = args;
    const revision = ++revisionRef.current;
    const startedOwner = latestRef.current.ownerId;
    const valid = () => revisionRef.current === revision &&
      latestRef.current.isOpen && latestRef.current.ownerId === startedOwner;
    const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
    const nextFrame = () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    const clear = () => {
      if (!valid()) return;
      if (overlayRef.current) {
        overlayRef.current.style.transition = '';
        overlayRef.current.style.opacity = '';
      }
      setLanding(null);
    };
    setLanding({ snapshot, target, phase: 'pending' });
    // Start moving to the already reserved neutral gap on the next frame,
    // instead of freezing under the released finger during local storage.
    void nextFrame().then(() => {
      if (!valid()) return;
      const overlay = overlayRef.current;
      const slot = landingSlot(swiperRef.current, target);
      if (overlay && slot && !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false))
        moveOverlay(overlay, slot, LANDING_DURATION_MS);
    });

    void (async () => {
      try {
        // An unresolved write must not leave a permanent floating card.
        // Guard cleanup does not cancel storage or start a second write.
        await Promise.race([
          Promise.resolve().then(commit),
          wait(WRITE_GUARD_MS).then(() => { throw new Error('Move is still saving. Check the destination before retrying.'); }),
        ]);
        if (!valid()) return;
        releaseSlot();
        // Give React the first frame to replace the neutral slot with a row,
        // then wait only for the exact destination (not an arbitrary sibling).
        await nextFrame();
        const deadline = Date.now() + DESTINATION_WAIT_MS;
        let targetElement = landingElement(swiperRef.current, target);
        while (!targetElement && valid() && Date.now() < deadline) {
          await nextFrame();
          targetElement = landingElement(swiperRef.current, target);
        }
        if (!valid()) return;
        const overlay = overlayRef.current;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (overlay && targetElement && !reduced) {
          moveOverlay(overlay, targetElement, LANDING_DURATION_MS);
          await wait(LANDING_DURATION_MS);
          if (!valid()) return;
        }
        // Reveal the real row *behind* the overlay before fading the overlay;
        // both are in the same final position, so no empty flash or double
        // FLIP from the source day.
        setLanding({ snapshot, target, phase: 'reveal' });
        if (overlay && !reduced) {
          overlay.style.transition = `opacity ${REVEAL_DURATION_MS}ms ease-out`;
          overlay.style.opacity = '0';
          await wait(REVEAL_DURATION_MS);
        }
        clear();
      } catch (error) {
        if (!valid()) return;
        releaseSlot();
        clear();
        onError(error);
      }
    })();
  }, [overlayRef, swiperRef]);

  // The new DOM row may render before its asynchronous write promise resolves.
  // A lightweight scoped style suppresses that single-frame flash; the source
  // overlay lives outside Swiper and is never hidden by this selector.
  const hideStyle = landing?.phase === 'pending' && landing.target.kind !== 'group' &&
    typeof document !== 'undefined' && createPortal(
      <style data-cross-day-landing-style="true">{`.swiper-slide-active [data-date-str="${attr(landing.target.date)}"] ${landing.target.kind === 'task'
        ? `[data-task-id="${attr(landing.target.id)}"]`
        : `[data-diary-note-row="${attr(landing.target.id)}"], .swiper-slide-active [data-date-str="${attr(landing.target.date)}"] [data-diary-reorder-id="${attr(landing.target.id)}"]`} { opacity: 0 !important; }`}</style>,
      document.head);
  return { landing, begin, cancel, hideStyle };
}
