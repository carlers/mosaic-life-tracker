import type { EmblaCarouselType } from 'embla-carousel';

/** Loaded with the optional inspector, never with the default Home calendar.
 * Rebuild the focused snap then correct any measured left-panel offset in
 * Embla's location and target without remounting its slide subtree. */
export function alignFocusedCalendarSlide(emblaApi: EmblaCarouselType, focusIndex: number): void {
  emblaApi.reInit({ startIndex: focusIndex });
  const slide = emblaApi.slideNodes()[focusIndex];
  if (!slide) return;
  const delta = slide.getBoundingClientRect().left
    - emblaApi.rootNode().getBoundingClientRect().left;
  if (Math.abs(delta) <= 1) return;
  const engine = emblaApi.internalEngine();
  const aligned = engine.location.get() - delta;
  engine.animation.stop();
  engine.location.set(aligned);
  engine.offsetLocation.set(aligned);
  engine.previousLocation.set(aligned);
  engine.target.set(aligned);
  engine.translate.to(aligned);
}
