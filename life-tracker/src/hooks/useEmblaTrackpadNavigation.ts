import { useEffect } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

/** Lazy trackpad adapter composes with Embla's own transform without scrolling its host. */
export function useEmblaTrackpadNavigation(api: EmblaCarouselType | undefined) {
  useEffect(() => {
    if (!api) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    void import('../lib/horizontalTrackpadSnap').then(({ attachHorizontalTrackpadNavigation }) => {
      if (disposed) return;
      // An already-snapped native Calendar rail must not start a second
      // animated Embla transition. Jump in the SAME paint as rail recenter.
      remove = attachHorizontalTrackpadNavigation(api.rootNode(), (dir, immediate) =>
        api.scrollTo(api.selectedScrollSnap() + (dir === 'next' ? 1 : -1), immediate));
    });
    return () => { disposed = true; remove?.(); };
  }, [api]);
}
