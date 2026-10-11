import { format } from 'date-fns';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

let idleCallback: IdleRequestCallback | null = null;
const mockPersons = [
  { id: 'me', kind: 'me', displayName: 'Me' },
  { id: 'friend_1', kind: 'friend', displayName: 'Friend' },
];
import { fireEvent, render, screen, act } from '@testing-library/react';
import { HomePage } from '../../src/pages/HomePage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
    persons: mockPersons,
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

const renderHome = () => render(<MemoryRouter><HomePage /></MemoryRouter>);

describe('HomePage task-search wiring', () => {
  beforeEach(() => {
    idleCallback = null;
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      idleCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps adjacent person panes out of the initial mount until idle', () => {
    renderHome();
    expect(screen.getAllByText('Pane')).toHaveLength(1);
    act(() => {
      idleCallback?.({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    });
    expect(screen.getAllByText('Pane')).toHaveLength(2);
  });

  // Regression: §2 (Home task-search history and owner Day View integration).
  it('uses a history entry for Home search so Android Back closes search before route navigation', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    expect(window.history.state).toEqual(
      expect.objectContaining({ mosaicHomeSearch: true })
    );

    fireEvent(window, new PopStateEvent('popstate'));

    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument();
  });

  it('makes the Home content inert while search is open', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));

    const inertRegion = document.querySelector('[inert]');
    expect(inertRegion).not.toBeNull();
    expect(inertRegion).toHaveTextContent('Carousel');
  });

  it('keeps Home search open when the selected task sheet closes', async () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select search task' }));
    expect(await screen.findByTestId('search-day-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close day view' }));

    expect(screen.getByRole('button', { name: 'Close search' })).toBeInTheDocument();

    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument();
  });

  it('opens Backlogs for an unscheduled search match', async () => {
    ownerTask.date = '';
    try {
      render(
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="/home" element={<HomePage />} />
            <Route path="/backlog" element={<div>Backlogs destination</div>} />
          </Routes>
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Select search task' }));
      expect(await screen.findByText('Backlogs destination')).toBeInTheDocument();
    } finally {
      ownerTask.date = '2026-09-24';
    }
  });

  it('opens Day View for the selected result without creating another data source', async () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Select search task' }));

    const sheet = await screen.findByTestId('search-day-view');
    expect(sheet).toHaveTextContent('2026-09-24');
    expect(sheet).toHaveTextContent('task_search');
    expect(sheet).toHaveTextContent('1');
  });
});
