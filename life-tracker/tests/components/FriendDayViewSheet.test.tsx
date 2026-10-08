// Regression: §2 (friend Day View swipes navigate adjacent days).
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

vi.mock('../../src/components/home/views/ImageViewer', () => ({
  ImageViewer: ({ isOpen, imageUrl }: { isOpen: boolean; imageUrl: string | null }) =>
    isOpen ? <div data-testid="friend-image-viewer">{imageUrl}</div> : null,
}));

vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: (fileId?: string) => ({
    imageUrl: fileId ? `blob:${fileId}` : null,
    isLoading: false,
  }),
}));

vi.mock('../../src/hooks/useImageLoadGate', () => ({
  useImageLoadGate: () => ({
    targetRef: () => undefined,
    shouldLoad: true,
  }),
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

const taskWithImage: TaskDocument = {
  id: 'task_1',
  userId: 'friend_1',
  categoryId: 'cat_1',
  order: 0,
  title: 'Photo task',
  memo: '',
  date: '2026-09-20',
  completed: false,
  image: 'tmimg_photo_1',
  visibility: 'followers',
  reactions: '',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
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

  it('renders a friend task photo and opens the shared image viewer', () => {
    render(
      <FriendDayViewSheet
        isOpen
        onClose={vi.fn()}
        date={new Date(2026, 8, 20)}
        onDateChange={vi.fn()}
        tasks={[taskWithImage]}
        categories={[category]}
        friendName="Friend"
        currentUserId="user_1"
      />
    );

    expect(screen.getByRole('img', { name: 'Photo task' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View image' }));

    expect(screen.getByTestId('friend-image-viewer')).toHaveTextContent(
      'blob:tmimg_photo_1'
    );
  });
  it('keeps the draggable date outside native day-swiping content', () => {
    render(
      <FriendDayViewSheet
        isOpen onClose={vi.fn()} date={new Date(2026, 8, 20)}
        onDateChange={vi.fn()} tasks={[]} categories={[]}
        friendName="Friend" currentUserId="user_1"
      />
    );
    const header = screen.getByText('Sunday, September 20, 2026');
    expect(header).toHaveAttribute('data-bottom-sheet-drag-handle', 'true');
    expect(header.closest('[data-bottom-sheet-native-horizontal-swipe]')).toBeNull();
  });

  it('shows task-level shared items without exposing an inaccessible category', () => {
    render(
      <FriendDayViewSheet
        isOpen onClose={vi.fn()} date={new Date(2026, 8, 20)}
        onDateChange={vi.fn()} tasks={[taskWithImage]} categories={[]}
        friendName="Friend" currentUserId="user_1"
      />
    );
    expect(screen.getByText('Shared tasks')).toBeInTheDocument();
    expect(screen.getByText('Photo task')).toBeInTheDocument();
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });

});
