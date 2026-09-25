import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarBody } from '../../src/components/home/views/CalendarBody';

vi.mock('../../src/components/home/views/CalendarCarousel', () => ({
  CalendarCarousel: () => <div data-testid="calendar-carousel" />,
}));

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: () => null,
}));

vi.mock('../../src/hooks/useTasksByDate', () => ({
  useTasksByDate: () => new Map(),
}));

vi.mock('../../src/hooks/useFriendTaskReply', () => ({
  useFriendTaskReply: () => ({
    replyTask: null,
    replyColor: '',
    feedback: null,
    handleReplyToTask: vi.fn(),
    handleReplySent: vi.fn(),
    closeReply: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useHorizontalArrowNavigation', () => ({
  useHorizontalArrowNavigation: vi.fn(),
}));

describe('CalendarBody layout', () => {
  it('gives the calendar carousel a bounded flex viewport so month height cannot resize the horizontal carousel', () => {
    const { getByTestId } = render(
      <CalendarBody
        viewMode="month"
        slides={[new Date('2026-01-01')]}
        renderStart={0}
        renderEnd={0}
        emblaRef={vi.fn()}
        tasks={[]}
        categoriesMap={{}}
        variant="me"
        currentUserId="user_1"
        isActive
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const carousel = getByTestId('calendar-carousel');
    const viewport = carousel.parentElement;

    expect(viewport).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
  });
});
