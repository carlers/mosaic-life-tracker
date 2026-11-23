import type { Swiper as SwiperClass } from 'swiper';

/** Gesture settle is Widgets-only code, not part of Calendar's startup bundle. */
export function settleWidgetReturn(
  swiper: SwiperClass | null, duration: number, done: (success: boolean) => void
): void {
  if (!swiper || duration === 0 || swiper.activeIndex === 1 && !swiper.animating) {
    done(true);
    return;
  }
  if (swiper.destroyed) { done(false); return; }
  let finished = false;
  const complete = () => {
    if (finished) return;
    finished = true;
    done(!swiper.destroyed && swiper.activeIndex === 1);
  };
  swiper.once('slideChangeTransitionEnd', complete);
  window.setTimeout(complete, duration + 50);
}
