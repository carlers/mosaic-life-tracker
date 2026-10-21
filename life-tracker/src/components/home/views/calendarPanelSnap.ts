import type { EmblaCarouselType } from 'embla-carousel';

/** Keep the focused month anchored to the current width without reInit.
 * A single full Embla measurement runs when the resize settles. */
export function updateFocusedCalendarSlide(emblaApi: EmblaCarouselType, focusIndex: number, live = false): void {
  if (!live) emblaApi.reInit({ startIndex: focusIndex });
  const slide = emblaApi.slideNodes()[focusIndex];
  if (!slide) return;
  const delta = slide.getBoundingClientRect().left
    - emblaApi.rootNode().getBoundingClientRect().left;
  if (Math.abs(delta) <= 0.25) return;
  const engine = emblaApi.internalEngine();
  const aligned = engine.location.get() - delta;
  engine.animation.stop();
  engine.location.set(aligned);
  engine.offsetLocation.set(aligned);
  engine.previousLocation.set(aligned);
  engine.target.set(aligned);
  engine.translate.to(aligned);
}
