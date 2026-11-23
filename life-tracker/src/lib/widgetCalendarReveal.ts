import { getLocalTodayKey } from './todayWidget';

/** Locate the actual owner date cell without causing the outer Home page to scroll. */
export async function revealWidgetDate(
  host: HTMLElement | null, date: Date, cancelled: () => boolean
): Promise<void> {
  const key = getLocalTodayKey(date);
  const reduced = document.documentElement.dataset.reduceMotion === 'true' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (let attempt = 0; attempt < 12 && !cancelled(); attempt += 1) {
    const viewport = host?.querySelector<HTMLElement>('[data-calendar-slide-index][role="region"]');
    const cell = viewport?.querySelector<HTMLElement>('[data-calendar-day="' + key + '"]');
    if (viewport && cell) {
      let moved = false;
      const target = Math.max(0, cell.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top + viewport.scrollTop -
        Math.max(0, viewport.clientHeight - cell.clientHeight) * 0.32);
      if (Math.abs(target - viewport.scrollTop) > 6) {
        if (viewport.scrollTo) viewport.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
        else viewport.scrollTop = target;
        moved = true;
      }
      const lane = cell.closest<HTMLElement>('[data-calendar-zoom-lane]');
      if (lane) {
        const left = Math.max(0, cell.getBoundingClientRect().left -
          lane.getBoundingClientRect().left + lane.scrollLeft -
          Math.max(0, lane.clientWidth - cell.clientWidth) * 0.35);
        if (Math.abs(left - lane.scrollLeft) > 6) {
          if (lane.scrollTo) lane.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
          else lane.scrollLeft = left;
          moved = true;
        }
      }
      // Allow the visible cell a brief smooth transition before presenting
      // the existing owner Day View. Never wait on network or animation settle.
      if (moved && !reduced) await new Promise<void>(resolve => window.setTimeout(resolve, 150));
      return;
    }
    await new Promise<void>(resolve => window.setTimeout(resolve, 16));
  }
}
