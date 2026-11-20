import { useEffect } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

/** The trackpad adapter remains a lazy Home chunk. Modern desktop browsers
 * use native scroll snapping (real release and inertia); older ones retain
 * the guarded wheel-idle fallback. */
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
