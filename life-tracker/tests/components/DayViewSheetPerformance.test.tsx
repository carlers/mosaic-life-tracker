import { useState, type ReactNode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

const fixture = vi.hoisted(() => ({
  onAnimationComplete: null as (() => void) | null,
  onChildrenReady: null as (() => void) | null,
  onClose: null as (() => void) | null,
}));

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({
    children,
    isOpen,
    onAnimationComplete,
    onChildrenReady,
    onClose,
    deferChildrenUntilAnimationComplete,
  }: {
    children: ReactNode;
    isOpen: boolean;
    onAnimationComplete?: () => void;
    onChildrenReady?: () => void;
    deferChildrenUntilAnimationComplete?: boolean;
  }) => {
    fixture.onAnimationComplete = onAnimationComplete ?? null;
    fixture.onChildrenReady = onChildrenReady ?? null;
    fixture.onClose = onClose;
    const [ready, setReady] = useState(!deferChildrenUntilAnimationComplete);
    if (!isOpen) return null;
    if (!ready) {
      fixture.onChildrenReady = () => {
        setReady(true);
        onChildrenReady?.();
      };
      return <div />;
    }
    return <div>{children}</div>;
  },
}));

vi.mock('../../src/components/home/views/DaySlide', () => ({
  DaySlide: () => <div data-testid="day-slide">Day content</div>,
}));

vi.mock('../../src/components/home/views/MemoSheet', () => ({
  MemoSheet: () => null,
}));
vi.mock('../../src/components/home/views/DatePickerSheet', () => ({
  DatePickerSheet: () => null,
}));
vi.mock('../../src/components/home/views/TaskVisibilitySheet', () => ({
  TaskVisibilitySheet: () => null,
}));
vi.mock('../../src/components/home/views/ImagePickerSheet', () => ({
  ImagePickerSheet: () => null,
}));
vi.mock('../../src/components/home/views/TaskActionSheet', () => ({
  TaskActionSheet: () => null,
}));
vi.mock('../../src/components/ui/ConfirmSheet', () => ({
  ConfirmSheet: () => null,
}));
vi.mock('../../src/components/home/views/ImageViewer', () => ({
  ImageViewer: () => null,
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [] as TaskDocument[],
    addTask: vi.fn(),
    toggleTaskCompletion: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [
      {
        id: 'cat_1',
        name: 'Work',
        color: '#3B82F6',
        order: 0,
        visibility: 'private',
        userId: 'user_1',
        isDeleted: false,
      } as CategoryDocument,
    ],
  }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_1' } }),
}));
vi.mock('../../src/hooks/useFeedback', () => ({
  useFeedback: () => ({ message: null }),
}));
vi.mock('../../src/hooks/useTaskImage', () => ({
  useTaskImage: () => ({ imageUrl: null, isLoading: false }),
}));
vi.mock('../../src/lib/storage', () => ({
  deleteImage: vi.fn(),
}));
vi.mock('../../src/hooks/useHorizontalArrowNavigation', () => ({
  useHorizontalArrowNavigation: vi.fn(),
}));
vi.mock('../../src/components/home/views/useDayViewSwiper', () => ({
  useDayViewSwiper: () => ({
    swiperRef: { current: null },
    slideDates: Array.from({ length: 181 }, (_, index) => new Date(2026, 8, 20 + index - 90)),
    slideDateStrs: Array.from({ length: 181 }, (_, index) => `2026-09-${String(((20 + index - 90 + 30) % 30) + 1).padStart(2, '0')}`),
    activeIndex: 90,
    initialIndex: 90,
    renderWindow: 3,
    handlePrevDay: vi.fn(),
    handleNextDay: vi.fn(),
    handleSwipeSettled: vi.fn(),
  }),
}));

import { DayViewSheet } from '../../src/components/home/views/DayViewSheet';

// Regression: task acceptance — sheet animation gets the first frame before non-active day trees mount.
describe('DayViewSheet mount scheduling', () => {
  it('mounts only the active day during sheet animation, then restores the full render window', () => {
    fixture.onAnimationComplete = null;
    fixture.onChildrenReady = null;

    render(
      <DayViewSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date(2026, 8, 20)}
      />
    );

    expect(screen.queryAllByTestId('day-slide')).toHaveLength(0);
    expect(
      document.querySelectorAll('[data-day-view-navigation="true"]')
    ).toHaveLength(0);
    expect(fixture.onChildrenReady).toEqual(expect.any(Function));

    act(() => {
      fixture.onChildrenReady?.();
    });

    expect(screen.getAllByTestId('day-slide')).toHaveLength(7);
    expect(
      document.querySelectorAll('[data-day-view-navigation="true"]')
    ).toHaveLength(7);

    act(() => {
      fixture.onClose?.();
    });

    expect(screen.getAllByTestId('day-slide')).toHaveLength(1);
    expect(
      document.querySelectorAll('[data-day-view-navigation="true"]')
    ).toHaveLength(1);
  });
});
