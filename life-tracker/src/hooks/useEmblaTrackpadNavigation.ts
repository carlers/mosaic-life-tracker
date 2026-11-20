import { useEffect } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

/** The wheel recognizer is separate from Home's startup bundle. The
 * compositor sees only one final scrollNext/Prev after the trackpad rests. */
export function useEmblaTrackpadNavigation(api: EmblaCarouselType | undefined) {
  useEffect(() => {
    if (!api) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    void import('../lib/horizontalTrackpadSnap').then(({ attachHorizontalTrackpadNavigation }) => {
      if (disposed) return;
      remove = attachHorizontalTrackpadNavigation(api.rootNode(), direction => {
        if (direction === 'next') api.scrollNext();
        else api.scrollPrev();
      });
    });
    return () => { disposed = true; remove?.(); };
  }, [api]);
}
