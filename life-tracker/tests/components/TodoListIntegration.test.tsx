// Regression: PROJECT_REFERENCE.md §2 — Todo List selected-day workspace is real Day View UI, not a mocked substitute.
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';

const fixture = vi.hoisted(() => ({
  task: {
    id: 'task_real',
    title: 'Integrated todo task',
    completed: false,
    categoryId: 'cat_real',
    date: '2026-09-15',
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: '',
    updatedAt: '2026-09-01T00:00:00.000Z',
    userId: 'user_1',
    isDeleted: false,
    visibility: 'private',
  } as TaskDocument,
  category: {
    id: 'cat_real',
    name: 'Integrated category',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    userId: 'user_1',
    isDeleted: false,
  } as CategoryDocument,
}));

vi.mock('../../src/components/home/views/TodoCalendarGrid', () => ({
  TodoCalendarGrid: () => <div data-testid="todo-grid-integration" />,
}));

vi.mock('swiper/react', () => ({
  Swiper: ({
    children,
    onSwiper,
    initialSlide = 0,
  }: {
    children: ReactNode;
    onSwiper?: (swiper: unknown) => void;
    initialSlide?: number;
  }) => {
    onSwiper?.({
      activeIndex: initialSlide,
      slideTo: vi.fn(),
      slidePrev: vi.fn(),
      slideNext: vi.fn(),
    });
    return <div data-testid="todo-day-swiper">{children}</div>;
  },
  SwiperSlide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    addTask: vi.fn(),
    toggleTaskCompletion: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] }),
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

import { TodoListView } from '../../src/components/home/views/TodoListView';

describe('TodoListView integrated selected-day workspace', () => {
  // Regression: PROJECT_REFERENCE.md §2 — supplied Todo data must render through actual DayViewSheet/DaySlide.
  it('renders the loaded category and task through the real inline Day View surface', () => {
    render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={[fixture.task]}
        categories={[fixture.category]}
        categoriesMap={{
          [fixture.category.id]: {
            color: fixture.category.color,
            name: fixture.category.name,
          },
        }}
        onFocusDateChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('Integrated category').length).toBeGreaterThan(0);
    expect(screen.getByText('Integrated todo task')).toBeInTheDocument();
    expect(screen.getByTestId('inline-day-view')).toBeInTheDocument();
  });

  // Regression: PROJECT_REFERENCE.md §2 — Todo owns one cohesive vertical page scroll.
  it('keeps the real selected-day content in page-scroll mode instead of a nested task scroller', () => {
    render(
      <TodoListView
        focusDate={new Date(2026, 8, 15)}
        tasks={[fixture.task]}
        categories={[fixture.category]}
        categoriesMap={{}}
        onFocusDateChange={vi.fn()}
      />
    );

    const task = screen.getByText('Integrated todo task');
    const daySlide = task.closest('[data-testid="day-slide"]');
    expect(daySlide).not.toBeNull();
    expect(daySlide).not.toHaveClass('overflow-y-auto');
    expect(daySlide).not.toHaveClass('h-full');
  });
});
