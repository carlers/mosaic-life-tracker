import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HomePage } from '../../src/pages/HomePage';

const ownerTask = {
  id: 'task_search',
  title: 'Search result',
  completed: false,
  categoryId: 'work',
  date: '2026-09-24',
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  userId: 'user_A',
  isDeleted: false,
  visibility: 'private' as const,
};

const ownerCategory = {
  id: 'work',
  name: 'Work',
  color: '#3B82F6',
  order: 0,
  visibility: 'private' as const,
  userId: 'user_A',
  isDeleted: false,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

vi.mock('swiper/react', () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('swiper/css', () => ({}));

vi.mock('../../src/hooks/useFriendCarousel', () => ({
  useFriendCarousel: () => ({
    persons: [{ id: 'me', kind: 'me', displayName: 'Me' }],
    reorder: vi.fn(),
    toggleVisibility: vi.fn(),
    resetOrder: vi.fn(),
    rawFriends: [],
    order: [],
    hidden: [],
  }),
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: [ownerTask], isLoading: false }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [ownerCategory], isLoading: false }),
}));

vi.mock('../../src/components/home/HomeTaskSearch', () => ({
  HomeTaskSearch: ({
    onSelectTask,
  }: {
    onSelectTask: (task: typeof ownerTask) => void;
  }) => (
    <button type="button" onClick={() => onSelectTask(ownerTask)}>
      Select search task
    </button>
  ),
}));
vi.mock('../../src/components/home/PersonCarousel', () => ({
  PersonCarousel: () => <div>Carousel</div>,
}));
vi.mock('../../src/components/home/PersonPane', () => ({
  PersonPane: () => <div>Pane</div>,
}));
vi.mock('../../src/components/home/FriendCarouselSettingsSheet', () => ({
  FriendCarouselSettingsSheet: () => null,
}));
vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: ({
    isOpen,
    selectedDate,
    focusTaskId,
    tasks,
    categories,
  }: {
    isOpen: boolean;
    selectedDate: Date;
    focusTaskId?: string | null;
    tasks?: Array<typeof ownerTask>;
    categories?: Array<typeof ownerCategory>;
  }) =>
    isOpen ? (
      <div data-testid="search-day-view">
        <span>{selectedDate.toISOString().slice(0, 10)}</span>
        <span>{focusTaskId}</span>
        <span>{tasks?.length}</span>
        <span>{categories?.length}</span>
      </div>
    ) : null,
}));

describe('HomePage task-search wiring', () => {
  // Regression: docs/PROJECT_REFERENCE.md §2 — selecting a local search result
  // opens the existing owner Day View for that exact date/task using the shared arrays.
  it('opens Day View for the selected result without creating another data source', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select search task' }));

    const sheet = screen.getByTestId('search-day-view');
    expect(sheet).toHaveTextContent('2026-09-24');
    expect(sheet).toHaveTextContent('task_search');
    expect(sheet).toHaveTextContent('1');
  });
});
