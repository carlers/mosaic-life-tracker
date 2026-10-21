// Regression: §2 (Calendar/Diary view switching remains reachable).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { addMonths, format } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/home/PersonProfileHeader', () => ({
  PersonProfileHeader: () => <div>Profile header</div>,
}));

vi.mock('../../src/components/home/views/CalendarBody', () => ({
  CalendarBody: () => <div data-testid="calendar-body">Calendar body</div>,
}));

vi.mock('../../src/hooks/useDiary', () => ({
  useDiary: () => ({
    entries: [], isLoading: false,
    getEntryByDate: () => undefined,
    saveEntry: vi.fn(), deleteEntry: vi.fn(),
  }),
}));

const lazyTodoFixture = vi.hoisted(() => ({
  loadGate: null as Promise<void> | null,
}));
vi.mock('../../src/components/home/views/todoListViewModule', () => ({
  LazyTodoListView: ({ variant = 'me', tasks = [], markerMode = 'todo' }: { variant?: string; tasks?: unknown[]; markerMode?: string }) => (
    <div data-testid="todo-list-view" data-variant={variant} data-task-count={tasks.length} data-marker-mode={markerMode} />
  ),
  preloadTodoListView: () => lazyTodoFixture.loadGate ?? Promise.resolve(),
}));

const calendarFixture = vi.hoisted(() => ({
  resetToToday: vi.fn(),
  options: undefined as { weekStartsOn?: 0 | 1 } | undefined,
}));

const settingsFixture = vi.hoisted(() => ({
  values: {
    weekStartsOnSunday: true,
  } as Record<string, unknown>,
}));

vi.mock('../../src/components/home/views/useCalendarState', () => ({
  useCalendarState: (options?: { weekStartsOn?: 0 | 1 }) => {
    calendarFixture.options = options;
    return {
      title: 'September 2026',
      viewMode: 'month',
      handleToggle: vi.fn(),
      handlePrev: vi.fn(),
      handleNext: vi.fn(),
      resetToToday: calendarFixture.resetToToday,
      slides: [new Date(2026, 8, 1)],
      renderStart: 0,
      renderEnd: 0,
      emblaRef: vi.fn(),
    };
  },
}));

vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: [] }),
}));

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] }),
}));

vi.mock('../../src/hooks/useMessageActions', () => ({
  useMessageActions: () => ({ sendTaskReaction: vi.fn() }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_1' } }),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string, defaultValue?: unknown) =>
      key in settingsFixture.values ? settingsFixture.values[key] : defaultValue,
    setSetting: vi.fn(),
  }),
}));

vi.mock('../../src/lib/useFriendCalendar', () => ({
  useFriendCalendar: () => ({
    tasks: [],
    categories: [],
    refetch: vi.fn(),
  }),
}));

import { PersonPane } from '../../src/components/home/PersonPane';
import type { CarouselPerson } from '../../src/hooks/useFriendCarousel';

const friend: CarouselPerson = {
  id: 'friend_1',
  kind: 'friend',
  userId: 'friend_1',
  username: 'friend',
  displayName: 'Friend',
  avatarFileId: '',
  bio: '',
};

const me: CarouselPerson = {
  id: 'me',
  kind: 'me',
  userId: 'user_1',
  username: 'me',
  displayName: 'Me',
  avatarFileId: '',
  bio: '',
};

describe('PersonPane view switcher', () => {
  beforeEach(() => {
    localStorage.clear();
    calendarFixture.resetToToday.mockClear();
    calendarFixture.options = undefined;
    settingsFixture.values = {
      weekStartsOnSunday: true,
    };
    lazyTodoFixture.loadGate = null;
  });

  // Regression: §2 (friends expose the shared Todo List and its date title returns to the current month).
  it('renders Todo List for a friend in friend mode and lets its date header return to today', async () => {
    // Warm the module before measuring UI behavior, not the CI runner's
    // dynamic-import cold start (which is nondeterministic under parallel tests).
    await import('../../src/components/home/FriendPersonPane');
    render(<PersonPane person={friend} isActive />);

    fireEvent.click(await screen.findByLabelText('Todo list', {}, { timeout: 5000 }));

    expect(await screen.findByTestId('todo-list-view')).toHaveAttribute('data-variant', 'friend');
    expect(screen.queryByTestId('diary-body')).toBeNull();

    const currentMonthTitle = format(new Date(), 'MMMM yyyy');
    const nextMonthTitle = format(addMonths(new Date(), 1), 'MMMM yyyy');
    expect(screen.getByRole('button', { name: 'Go to today' })).toHaveTextContent(currentMonthTitle);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Go to today' })).toHaveTextContent(nextMonthTitle);

    fireEvent.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(screen.getByRole('button', { name: 'Go to today' })).toHaveTextContent(currentMonthTitle);
  });

  // Regression: §2 (calendar preferences apply through the person pane and the date title always returns to today).
  it('uses Monday week start and lets the calendar date header jump to today', () => {
    settingsFixture.values = {
      weekStartsOnSunday: false,
    };

    render(<PersonPane person={me} isActive />);

    expect(calendarFixture.options).toEqual({ weekStartsOn: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(calendarFixture.resetToToday).toHaveBeenCalledOnce();
  });

  // Regression: §2 (owner Todo date title returns to the month containing today).
  it('lets the owner Todo date header return to the current month', async () => {
    render(<PersonPane person={me} isActive />);

    fireEvent.click(screen.getByLabelText('Todo list'));
    await screen.findByTestId('todo-list-view');

    const currentMonthTitle = format(new Date(), 'MMMM yyyy');
    const nextMonthTitle = format(addMonths(new Date(), 1), 'MMMM yyyy');
    expect(screen.getByRole('button', { name: 'Go to today' })).toHaveTextContent(currentMonthTitle);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Go to today' })).toHaveTextContent(nextMonthTitle);

    fireEvent.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(screen.getByRole('button', { name: 'Go to today' })).toHaveTextContent(currentMonthTitle);
  });

  it('renders the Diary calendar workspace and lets the user switch back to Calendar', async () => {
    render(<PersonPane person={me} isActive />);

    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Diary'));
    expect(await screen.findByTestId('todo-list-view')).toHaveAttribute('data-marker-mode', 'diary');
    expect(screen.getByLabelText('Calendar')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Calendar'));
    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();
  });
  // Regression #858: a first view switch must not replace the already-visible
  // Calendar with an empty Suspense fallback while the Todo/Diary module loads.
  it('keeps Calendar on screen until the first Todo module is ready', async () => {
    let release!: () => void;
    lazyTodoFixture.loadGate = new Promise<void>(resolve => { release = resolve; });
    render(<PersonPane person={me} isActive />);
    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Todo list'));
    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();
    expect(screen.queryByTestId('todo-list-view')).toBeNull();
    await act(async () => { release(); });
    expect(await screen.findByTestId('todo-list-view')).toHaveAttribute('data-marker-mode', 'todo');
  });

  it('ignores a pending Diary module when Calendar was selected afterward', async () => {
    let release!: () => void;
    lazyTodoFixture.loadGate = new Promise<void>(resolve => { release = resolve; });
    render(<PersonPane person={me} isActive />);

    fireEvent.click(screen.getByLabelText('Diary'));
    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Calendar'));
    await act(async () => { release(); });
    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();
    expect(screen.queryByTestId('todo-list-view')).toBeNull();
  });

});
