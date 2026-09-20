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

vi.mock('../../src/components/home/views/useCalendarState', () => ({
  useCalendarState: () => ({
    title: 'September 2026',
    viewMode: 'month',
    handleToggle: vi.fn(),
    handlePrev: vi.fn(),
    handleNext: vi.fn(),
    slides: [new Date(2026, 8, 1)],
    renderStart: 0,
    renderEnd: 0,
    emblaRef: vi.fn(),
  }),
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

vi.mock('../../src/lib/useFriendCalendar', () => ({
  useFriendCalendar: () => ({
    tasks: [],
    categories: [],
    refetch: vi.fn(),
  }),
}));

import { PersonPane } from '../../src/components/home/PersonPane';
import type { CarouselPerson } from '../../src/hooks/useFriendCarousel';

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
