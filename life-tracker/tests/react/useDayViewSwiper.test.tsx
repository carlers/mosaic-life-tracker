// Regression: §2 (Day View arrow navigation behaves like user navigation).
import { act, renderHook } from '@testing-library/react';
import { addDays, startOfDay } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import type { Swiper as SwiperClass } from 'swiper';
import { useDayViewSwiper } from '../../src/components/home/views/useDayViewSwiper';

function makeSwiper(initialIndex: number) {
  const swiper = {
    activeIndex: initialIndex,
    destroyed: false,
    slideTo: vi.fn((index: number) => {
      swiper.activeIndex = index;
    }),
    slidePrev: vi.fn(() => {
      swiper.activeIndex -= 1;
    }),
    slideNext: vi.fn(() => {
      swiper.activeIndex += 1;
    }),
    updateSlides: vi.fn(),
  };
  return swiper as unknown as SwiperClass;
}

describe('useDayViewSwiper', () => {
  it('next-arrow navigation reports the next day instead of being suppressed as programmatic', () => {
    const selectedDate = new Date(2026, 8, 20);
    const onDateChange = vi.fn();
    const { result } = renderHook(() =>
      useDayViewSwiper({
        isOpen: true,
        selectedDate,
        onDateChange,
        isDisabled: false,
      })
    );
    const swiper = makeSwiper(result.current.initialIndex);
    result.current.swiperRef.current = swiper;

    act(() => {
      result.current.handleNextDay();
      result.current.handleSwipeSettled(swiper);
    });

    expect(onDateChange).toHaveBeenCalledWith(
      addDays(startOfDay(selectedDate), 1)
    );
  });

  it('moves the swiper directly for a large selected-date jump', () => {
    const initialDate = new Date(2026, 8, 11);
    const selectedDate = new Date(2026, 8, 30);
    const { result, rerender } = renderHook(
      ({ date }) =>
        useDayViewSwiper({
          isOpen: true,
          selectedDate: date,
          isDisabled: false,
        }),
      { initialProps: { date: initialDate } }
    );
    const swiper = makeSwiper(result.current.initialIndex);
    result.current.swiperRef.current = swiper;

    act(() => {
      rerender({ date: selectedDate });
    });

    expect(swiper.slideTo).toHaveBeenCalledWith(result.current.initialIndex, 0);
    expect(swiper.updateSlides).toHaveBeenCalled();
  });

  // Regression: §2 (Day View reopen ignores a destroyed Swiper from the prior sheet).
  it('ignores a destroyed swiper while reopening on another day', () => {
    const initialDate = new Date(2026, 8, 20);
    const reopenedDate = new Date(2026, 8, 21);
    const { result, rerender } = renderHook(
      ({ isOpen, date }) =>
        useDayViewSwiper({
          isOpen,
          selectedDate: date,
          isDisabled: false,
        }),
      { initialProps: { isOpen: false, date: initialDate } }
    );
    const staleSwiper = makeSwiper(result.current.initialIndex);
    staleSwiper.destroyed = true;
    result.current.swiperRef.current = staleSwiper;

    act(() => {
      rerender({ isOpen: true, date: reopenedDate });
    });

    expect(staleSwiper.slideTo).not.toHaveBeenCalled();
    expect(staleSwiper.updateSlides).not.toHaveBeenCalled();

    act(() => {
      result.current.handlePrevDay();
      result.current.handleNextDay();
    });

    expect(staleSwiper.slidePrev).not.toHaveBeenCalled();
    expect(staleSwiper.slideNext).not.toHaveBeenCalled();
  });

  it('does not move the swiper while a nested sheet disables day navigation', () => {
    const { result } = renderHook(() =>
      useDayViewSwiper({
        isOpen: true,
        selectedDate: new Date(2026, 8, 20),
        isDisabled: true,
      })
    );
    const swiper = makeSwiper(result.current.initialIndex);
    result.current.swiperRef.current = swiper;

    act(() => {
      result.current.handlePrevDay();
      result.current.handleNextDay();
    });

    expect(swiper.slidePrev).not.toHaveBeenCalled();
    expect(swiper.slideNext).not.toHaveBeenCalled();
  });
});
