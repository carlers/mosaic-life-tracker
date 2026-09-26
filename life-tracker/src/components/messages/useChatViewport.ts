import { useLayoutEffect, useState, type CSSProperties } from 'react';

/** One viewport owner for the whole chat, including its header and dock. */
export function useChatViewport(enabled: boolean): CSSProperties | undefined {
  const [viewport, setViewport] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!enabled) return;
    const visual = window.visualViewport;
    if (!visual) return;
    let frame = 0;
    const measure = () => {
      // Keep normal document geometry while the user is pinch-zooming.
      setViewport(Math.abs(visual.scale - 1) > 0.01
        ? undefined
        : { height: visual.height, top: visual.offsetTop });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    visual.addEventListener('resize', schedule);
    visual.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      visual.removeEventListener('resize', schedule);
      visual.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled]);
  return enabled ? viewport : undefined;
}
