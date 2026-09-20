// Regression: UIFIX-10 — day arrows must behave like user navigation.
import { act, renderHook } from '@testing-library/react';
import { addDays, startOfDay } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import type { Swiper as SwiperClass } from 'swiper';
import { useDayViewSwiper } from '../../src/components/home/views/useDayViewSwiper';

function makeSwiper(initialIndex: number) {
  const swiper = {
    activeIndex: initialIndex,
    slideTo: vi.fn((index: number) => {
      swiper.activeIndex = index;
    }),
    slidePrev: vi.fn(() => {
      swiper.activeIndex -= 1;
    }),
    slideNext: vi.fn(() => {
      swiper.activeIndex += 1;
    }),
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

  it('previous-arrow navigation reports the previous day', () => {
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
      result.current.handlePrevDay();
      result.current.handleSwipeSettled(swiper);
    });

    expect(onDateChange).toHaveBeenCalledWith(
      addDays(startOfDay(selectedDate), -1)
    );
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
