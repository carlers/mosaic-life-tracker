import type { EmblaCarouselType } from 'embla-carousel';

/** Keep the focused month anchored to the current width without reInit.
 * A single full Embla measurement runs when the resize settles. */
export function updateFocusedCalendarSlide(emblaApi: EmblaCarouselType, focusIndex: number, live = false): void {
  emblaApi.rootNode().style.setProperty('--mosaic-panel-focused-slide', `${-100 * focusIndex}%`);
  if (!live) emblaApi.reInit({ startIndex: focusIndex });
  const slide = emblaApi.slideNodes()[focusIndex];
  if (!slide) return;
  const first = emblaApi.slideNodes()[0];
  if (!first) return;
  // Use current DOM slide geometry, not Embla's cached pre-resize snap.
  // The carousel's flex slides start at the viewport's left edge.
  const aligned = first.getBoundingClientRect().left
    - slide.getBoundingClientRect().left;
  const engine = emblaApi.internalEngine();
  engine.animation.stop();
  engine.location.set(aligned);
  engine.offsetLocation.set(aligned);
  engine.previousLocation.set(aligned);
  engine.target.set(aligned);
  engine.translate.to(aligned);
}
