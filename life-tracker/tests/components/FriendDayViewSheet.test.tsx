// Regression: pre-Phase-4 UI bug batch — friend day sheets must navigate adjacent days by swipe.
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { addDays, startOfDay } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

vi.mock('swiper/react', () => ({
  Swiper: ({
    children,
    onSwiper,
    onSlideChange,
    initialSlide = 0,
  }: {
    children: ReactNode;
    onSwiper?: (swiper: unknown) => void;
    onSlideChange?: (swiper: unknown) => void;
    initialSlide?: number;
  }) => {
    const swiper = {
      activeIndex: initialSlide,
      slideTo: vi.fn((index: number) => {
        swiper.activeIndex = index;
      }),
      slidePrev: vi.fn(() => {
        swiper.activeIndex -= 1;
        onSlideChange?.(swiper);
      }),
      slideNext: vi.fn(() => {
        swiper.activeIndex += 1;
        onSlideChange?.(swiper);
      }),
    };
    onSwiper?.(swiper);
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            swiper.activeIndex += 1;
            onSlideChange?.(swiper);
          }}
        >
          Simulate swipe
        </button>
        {children}
      </div>
    );
  },
  SwiperSlide: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../src/components/messages/EmojiPickerSheet', () => ({
  EmojiPickerSheet: () => null,
}));

const category: CategoryDocument = {
  id: 'cat_1',
  name: 'Work',
  color: '#3B82F6',
  order: 0,
  visibility: 'private',
  userId: 'friend_1',
  isDeleted: false,
};

const tasks: TaskDocument[] = [];

import { FriendDayViewSheet } from '../../src/components/friend/FriendDayViewSheet';

describe('FriendDayViewSheet', () => {
  it('reports the adjacent date after a horizontal swipe settles', () => {
    const date = new Date(2026, 8, 20);
    const onDateChange = vi.fn();

    render(
      <FriendDayViewSheet
        isOpen
        onClose={vi.fn()}
        date={date}
        onDateChange={onDateChange}
        tasks={tasks}
        categories={[category]}
        friendName="Friend"
        currentUserId="user_1"
      />
    );

    fireEvent.click(screen.getByText('Simulate swipe'));

    expect(onDateChange).toHaveBeenCalledWith(addDays(startOfDay(date), 1));
  });

  it('keeps arrow navigation wired to the same adjacent-day behavior', () => {
    const date = new Date(2026, 8, 20);
    const onDateChange = vi.fn();

    render(
      <FriendDayViewSheet
        isOpen
        onClose={vi.fn()}
        date={date}
        onDateChange={onDateChange}
        tasks={tasks}
        categories={[category]}
        friendName="Friend"
        currentUserId="user_1"
      />
    );

    fireEvent.click(screen.getByLabelText('Next day'));

    expect(onDateChange).toHaveBeenCalledWith(addDays(startOfDay(date), 1));
  });
});
