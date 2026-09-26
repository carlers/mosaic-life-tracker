// Regression: UIFIX-1 — switching to Diary must not remove the Calendar/Diary toggle.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/home/PersonProfileHeader', () => ({
  PersonProfileHeader: () => <div>Profile header</div>,
}));

vi.mock('../../src/components/home/views/CalendarBody', () => ({
  CalendarBody: () => <div data-testid="calendar-body">Calendar body</div>,
}));

vi.mock('../../src/components/layout/ComingSoon', () => ({
  ComingSoon: () => <div data-testid="diary-body">Diary body</div>,
}));

vi.mock('../../src/components/home/views/TodoListView', () => ({
  TodoListView: ({ variant = 'me', tasks = [] }: { variant?: string; tasks?: unknown[] }) => (
    <div data-testid="todo-list-view" data-variant={variant} data-task-count={tasks.length} />
  ),
}));

const calendarFixture = vi.hoisted(() => ({
  resetToToday: vi.fn(),
  options: undefined as { weekStartsOn?: 0 | 1 } | undefined,
}));

const settingsFixture = vi.hoisted(() => ({
  values: {
    weekStartsOnSunday: true,
    tapCalendarDateToToday: false,
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
      tapCalendarDateToToday: false,
    };
  });

  // Regression: PROJECT_REFERENCE.md §2 — friends expose shared Todo List instead of Coming Soon.
  it('renders Todo List for a friend in friend mode', () => {
    render(<PersonPane person={friend} isActive />);

    fireEvent.click(screen.getByLabelText('Todo list'));

    expect(screen.getByTestId('todo-list-view')).toHaveAttribute('data-variant', 'friend');
    expect(screen.queryByTestId('diary-body')).toBeNull();
  });

  // Regression: PROJECT_REFERENCE.md §2 — calendar behavior preferences are wired at the person-pane boundary.
  it('uses Monday week start and lets the calendar date header jump to today when enabled', () => {
    settingsFixture.values = {
      weekStartsOnSunday: false,
      tapCalendarDateToToday: true,
    };

    render(<PersonPane person={me} isActive />);

    expect(calendarFixture.options).toEqual({ weekStartsOn: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(calendarFixture.resetToToday).toHaveBeenCalledOnce();
  });

  it('keeps the toggle visible in Diary and lets the user switch back to Calendar', () => {
    render(<PersonPane person={me} isActive />);

    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Diary'));
    expect(screen.getByTestId('diary-body')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Calendar'));
    expect(screen.getByTestId('calendar-body')).toBeInTheDocument();
  });
});
