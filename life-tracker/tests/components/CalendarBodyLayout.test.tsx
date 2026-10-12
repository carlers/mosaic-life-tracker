import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarBody } from '../../src/components/home/views/CalendarBody';
import { preloadFriendDayViewSheet } from '../../src/components/friend/friendDayViewSheetModule';

const daySheetState = vi.fn();

vi.mock('../../src/components/home/views/CalendarCarousel', () => ({
  CalendarCarousel: ({ onDayClick }: { onDayClick: (date: Date) => void }) => (
    <div data-testid="calendar-carousel">
      <button data-testid="calendar-day" onClick={() => onDayClick(new Date('2026-01-05'))}>
        day
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: (props: { isOpen: boolean; selectedDate: Date }) => {
    daySheetState(props);
    return <div data-testid="day-view-sheet" data-open={props.isOpen} />;
  },
}));

vi.mock('../../src/components/friend/FriendDayViewSheet', () => ({
  FriendDayViewSheet: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Friend day" /> : null,
}));

vi.mock('../../src/components/messages/ReplyComposerSheet', () => ({
  ReplyComposerSheet: () => null,
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

describe('CalendarBody behavior', () => {
  it('opens the DayView sheet immediately from a day tap', async () => {
    daySheetState.mockClear();
    const { getByTestId, findByTestId } = render(
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

    fireEvent.click(getByTestId('calendar-day'));

    expect(await findByTestId('day-view-sheet')).toHaveAttribute('data-open', 'true');
    expect(daySheetState.mock.calls.at(-1)?.[0]).toMatchObject({
      isOpen: true,
      selectedDate: new Date('2026-01-05'),
    });
  });

  it('mounts a warmed friend Day View on the first day-cell commit', async () => {
    await preloadFriendDayViewSheet();
    const { getByTestId, getByRole } = render(
      <CalendarBody
        viewMode="month" slides={[new Date('2026-01-01')]}
        renderStart={0} renderEnd={0} emblaRef={vi.fn()}
        tasks={[]} categoriesMap={{}} variant="friend"
        friendName="Friend" friendUserId="friend_1"
        currentUserId="user_1" isActive
        onPrev={vi.fn()} onNext={vi.fn()}
      />
    );
    fireEvent.click(getByTestId('calendar-day'));
    // A resolved import must not suspend for one blank React commit.
    expect(getByRole('dialog', { name: 'Friend day' })).toBeInTheDocument();
  });
  it('uses a non-modal panel when the usable Home frame is wide enough', async () => {
    const original = globalThis.ResizeObserver;
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ width: 1300, height: 700, top: 0, left: 0, right: 1300, bottom: 700, x: 0, y: 0, toJSON: () => ({}) })
    );
    class TestObserver { observe() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', TestObserver);
    try {
      daySheetState.mockClear();
      const { getByTestId, findByRole, queryByRole } = render(
        <CalendarBody
          viewMode="month" slides={[new Date('2026-01-01')]}
          renderStart={0} renderEnd={0} emblaRef={vi.fn()}
          tasks={[]} categoriesMap={{}} variant="me"
          dayDetailPresentation="panel"
          currentUserId="user_1" isActive
          onPrev={vi.fn()} onNext={vi.fn()}
        />
      );
      fireEvent.click(getByTestId('calendar-day'));
      expect(await findByRole('complementary', { name: 'Day details' })).toBeInTheDocument();
      expect(queryByRole('dialog', { name: 'Day details' })).toBeNull();
      expect(daySheetState.mock.calls.at(-1)?.[0]).toMatchObject({
        renderMode: 'panel', isOpen: true,
      });
      // The calendar remains interactive and the same panel updates in place.
      const originalPanel = getByTestId('calendar-day-side-panel');
      fireEvent.click(getByTestId('calendar-day'));
      expect(getByTestId('calendar-day-side-panel')).toBe(originalPanel);
      fireEvent.click((await findByRole('button', { name: 'Close day details' })));
      expect(queryByRole('complementary', { name: 'Day details' })).toBeNull();
    } finally {
      rect.mockRestore();
      if (original === undefined) vi.unstubAllGlobals();
      else vi.stubGlobal('ResizeObserver', original);
    }
  });

});
