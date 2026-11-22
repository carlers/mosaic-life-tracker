import { useEffect } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

/** Lazy trackpad adapter composes with Embla's own transform without scrolling its host. */
export function useEmblaTrackpadNavigation(api: EmblaCarouselType | undefined) {
  useEffect(() => {
    if (!api) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    let releaseMedia: (() => void) | undefined;
    void import('../lib/horizontalTrackpadSnap').then(({ attachHorizontalTrackpadNavigation, attachCalendarMediaPause }) => {
      if (disposed) return;
      // An already-snapped native Calendar rail must not start a second
      // animated Embla transition. Jump in the SAME paint as rail recenter.
      releaseMedia = attachCalendarMediaPause(api);
      remove = attachHorizontalTrackpadNavigation(
        api.rootNode(),
        (dir, immediate) =>
          api.scrollTo(api.selectedScrollSnap() + (dir === 'next' ? 1 : -1), immediate),
        () => true,
        dir => dir === 'next' ? api.canScrollNext() : api.canScrollPrev(),
      );
    });
    return () => { disposed = true; remove?.(); releaseMedia?.(); };
  }, [api]);
}
