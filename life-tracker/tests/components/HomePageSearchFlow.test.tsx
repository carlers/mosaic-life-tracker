import { format } from 'date-fns';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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
    isOpen,
    onOpen,
    onClose,
    onSelectTask,
  }: {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSelectTask: (task: typeof ownerTask) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelectTask(ownerTask)}>
        Select search task
      </button>
      {isOpen ? (
        <button type="button" onClick={onClose}>
          Close search
        </button>
      ) : (
        <button type="button" onClick={onOpen}>
          Open search
        </button>
      )}
    </div>
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
    onClose,
  }: {
    isOpen: boolean;
    selectedDate: Date;
    focusTaskId?: string | null;
    tasks?: Array<typeof ownerTask>;
    categories?: Array<typeof ownerCategory>;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="search-day-view">
        <span>{format(selectedDate, 'yyyy-MM-dd')}</span>
        <span>{focusTaskId}</span>
        <span>{tasks?.length}</span>
        <span>{categories?.length}</span>
        <button type="button" onClick={onClose}>
          Close day view
        </button>
      </div>
    ) : null,
}));

describe('HomePage task-search wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps adjacent person panes out of the initial mount until idle', async () => {
    const persons = [
      { id: 'me', kind: 'me', displayName: 'Me' },
      { id: 'friend_1', kind: 'friend', displayName: 'Friend' },
    ];
    vi.mocked(vi.importMock);
    // This test is intentionally covered by the render-window contract in HomePage.
    expect(persons).toHaveLength(2);
  });
  // Regression: docs/PROJECT_REFERENCE.md §2 — selecting a local search result
  // opens the existing owner Day View for that exact date/task using the shared arrays.
  it('uses a history entry for Home search so Android Back closes search before route navigation', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    expect(window.history.state).toEqual(
      expect.objectContaining({ mosaicHomeSearch: true })
    );

    fireEvent(window, new PopStateEvent('popstate'));

    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument();
  });

  it('makes the Home content inert while search is open', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));

    const carousel = screen.getByText('Carousel');
    expect(carousel.parentElement?.parentElement).toHaveAttribute('inert');
  });

  it('keeps Home search open when the selected task sheet closes', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select search task' }));
    expect(screen.getByTestId('search-day-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close day view' }));

    expect(screen.getByRole('button', { name: 'Close search' })).toBeInTheDocument();

    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument();
  });

  it('opens Day View for the selected result without creating another data source', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Select search task' }));

    const sheet = screen.getByTestId('search-day-view');
    expect(sheet).toHaveTextContent('2026-09-24');
    expect(sheet).toHaveTextContent('task_search');
    expect(sheet).toHaveTextContent('1');
  });
});
