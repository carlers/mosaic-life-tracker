/** Navigate exclusively inside the Daily Review strip, never its ancestor Swiper. */
export function scrollReviewStripToStage(
  strip: HTMLElement, first: HTMLElement, target: HTMLElement,
): void {
  if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches) return;
  strip.scrollTo({
    left: target.offsetLeft - first.offsetLeft,
    behavior: typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}
