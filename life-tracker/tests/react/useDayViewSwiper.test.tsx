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
      result.current.handleSlideChange(swiper);
    });

    expect(result.current.activeIndex).toBe(result.current.initialIndex + 1);
    expect(onDateChange).not.toHaveBeenCalled();

    act(() => {
      result.current.handleSwipeSettled(swiper);
    });

    expect(onDateChange).toHaveBeenCalledWith(
      addDays(startOfDay(selectedDate), 1)
    );
  });

  it('keeps rapid slide changes local until the latest snap settles', () => {
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
      swiper.activeIndex += 1;
      result.current.handleSlideChange(swiper);
      swiper.activeIndex += 1;
      result.current.handleSlideChange(swiper);
      swiper.activeIndex += 1;
      result.current.handleSlideChange(swiper);
    });

    expect(result.current.activeIndex).toBe(result.current.initialIndex + 3);
    expect(onDateChange).not.toHaveBeenCalled();

    act(() => {
      result.current.handleSwipeSettled(swiper);
    });

    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenCalledWith(
      addDays(startOfDay(selectedDate), 3)
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
    const originalAnchor = result.current.anchorKey;

    act(() => {
      rerender({ date: selectedDate });
    });

    expect(result.current.anchorKey).toBe(originalAnchor);
    expect(swiper.slideTo).toHaveBeenCalledWith(result.current.initialIndex, 0);
    expect(swiper.updateSlides).toHaveBeenCalled();
  });

  it('re-centers a date outside the original 90-day window without showing a boundary day', () => {
    const origin = new Date(2026, 8, 11);
    const far = addDays(origin, 120);
    const onDateChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ date }) => useDayViewSwiper({
        isOpen: true, selectedDate: date, isDisabled: false, onDateChange,
      }),
      { initialProps: { date: origin } }
    );
    const oldAnchor = result.current.anchorKey;

    act(() => rerender({ date: far }));
    expect(result.current.anchorKey).not.toBe(oldAnchor);
    expect(result.current.initialIndex).toBe(90);
    expect(result.current.activeIndex).toBe(90);
    expect(result.current.slideDates[result.current.activeIndex]).toEqual(startOfDay(far));
    expect(result.current.slideDateStrs[90]).toBe(
      [far.getFullYear(), String(far.getMonth() + 1).padStart(2, '0'), String(far.getDate()).padStart(2, '0')].join('-')
    );

    // After the keyed Swiper remount, a normal next-day gesture must
    // continue from the selected date, not from the old end of the window.
    const freshSwiper = makeSwiper(result.current.initialIndex);
    result.current.swiperRef.current = freshSwiper;
    act(() => {
      freshSwiper.activeIndex++;
      result.current.handleSlideChange(freshSwiper);
      result.current.handleSwipeSettled(freshSwiper);
    });
    expect(onDateChange).toHaveBeenCalledWith(addDays(startOfDay(far), 1));
  });

  it('re-centers backward jumps and refreshes a long-running near-edge window', () => {
    const origin = new Date(2026, 8, 11);
    const { result, rerender } = renderHook(
      ({ date }) => useDayViewSwiper({
        isOpen: true, selectedDate: date, isDisabled: false,
      }),
      { initialProps: { date: origin } }
    );
    const anchor = result.current.anchorKey;
    const farPast = addDays(origin, -190);
    act(() => rerender({ date: farPast }));
    expect(result.current.anchorKey).not.toBe(anchor);
    expect(result.current.slideDates[90]).toEqual(startOfDay(farPast));

    const reboundAnchor = result.current.anchorKey;
    // Repeated normal navigation must never run out of adjacent day slots.
    act(() => rerender({ date: addDays(farPast, 86) }));
    expect(result.current.anchorKey).toBe(reboundAnchor);
    act(() => rerender({ date: addDays(farPast, 87) }));
    expect(result.current.anchorKey).not.toBe(reboundAnchor);
    expect(result.current.activeIndex).toBe(90);
    expect(result.current.slideDates[90]).toEqual(startOfDay(addDays(farPast, 87)));
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
