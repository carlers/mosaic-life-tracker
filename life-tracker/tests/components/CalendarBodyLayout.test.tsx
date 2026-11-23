import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarBody } from '../../src/components/home/views/CalendarBody';
import { LazyFriendDayViewSheet, preloadFriendDayViewSheet } from '../../src/components/friend/friendDayViewSheetModule';
import { DISABLED_HOLIDAY_CONFIG } from '../../src/lib/holidays';
import type { TaskDocument } from '../../src/db/schema';

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
  DayPanelWallpaper: () => null,
  DayViewSheet: (props: { isOpen: boolean; selectedDate: Date }) => {
    daySheetState(props);
    return <div data-testid="day-view-sheet" data-open={props.isOpen} />;
  },
}));

vi.mock('../../src/components/friend/FriendDayViewSheet', () => ({
  FriendDayViewSheet: ({ isOpen, onReplyToTask }: {
    isOpen: boolean;
    onReplyToTask?: (task: TaskDocument, color: string) => void;
  }) => isOpen ? <div role="dialog" aria-label="Friend day">
    <button onClick={() => onReplyToTask?.({ id: 'friend-task' } as TaskDocument, '#123456')}>
      Reply to friend task
    </button>
  </div> : null,
}));

vi.mock('../../src/components/messages/ReplyComposerSheet', () => ({
  ReplyComposerSheet: () => null,
}));

// Calendar layout tests isolate panel geometry; wallpaper preferences have their own coverage.
vi.mock('../../src/lib/useDayViewWallpaperStyle', () => ({
  useDayViewWallpaperStyle: () => undefined,
  useDayViewWallpaperAppearance: () => ({ style: undefined, glass: false }),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({ getSetting: (_key: string, fallback: unknown) => fallback, setSetting: vi.fn() }),
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

// The friend pane supplies the renderer; owner Home never imports friend sheet UI.
const friendSheet = (onReplyToTask?: (task: TaskDocument, color: string) => void) =>
  (isOpen: boolean, date: Date, onClose: () => void, onDateChange: (date: Date) => void) => (
    <LazyFriendDayViewSheet
      isOpen={isOpen} date={date} onClose={onClose} onDateChange={onDateChange}
      tasks={[]} categories={[]} friendName="Friend" currentUserId="user_1"
      onReplyToTask={onReplyToTask} holidayConfig={DISABLED_HOLIDAY_CONFIG} />
  );

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
        preloadFriendDaySheet={preloadFriendDayViewSheet}
        renderFriendDaySheet={friendSheet()}
        currentUserId="user_1" isActive
        onPrev={vi.fn()} onNext={vi.fn()}
      />
    );
    fireEvent.click(getByTestId('calendar-day'));
    // A resolved import must not suspend for one blank React commit.
    expect(getByRole('dialog', { name: 'Friend day' })).toBeInTheDocument();
  });
  it('forwards the friend-only reply state to the Day View without running it for the owner', async () => {
    const onReply = vi.fn();
    await preloadFriendDayViewSheet();
    const { getByTestId, findByRole } = render(
      <CalendarBody
        viewMode="month" slides={[new Date('2026-01-01')]}
        renderStart={0} renderEnd={0} emblaRef={vi.fn()}
        tasks={[]} categoriesMap={{}} variant="friend"
        friendName="Friend" friendUserId="friend_1"
        preloadFriendDaySheet={preloadFriendDayViewSheet}
        renderFriendDaySheet={friendSheet(onReply)}
        friendReply={{
          replyTask: null, replyColor: '', feedback: null,
          handleReplyToTask: onReply, handleReplySent: vi.fn(), closeReply: vi.fn(),
        }}
        currentUserId="user_1" isActive
        onPrev={vi.fn()} onNext={vi.fn()}
      />
    );
    fireEvent.click(getByTestId('calendar-day'));
    fireEvent.click(await findByRole('button', { name: 'Reply to friend task' }));
    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 'friend-task' }), '#123456');
  });

  it('keeps the interactive calendar and a non-modal left split panel mounted across date taps', async () => {
    const original = globalThis.ResizeObserver;
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ width: 1300, height: 700, top: 0, left: 0, right: 1300, bottom: 700, x: 0, y: 0, toJSON: () => ({}) })
    );
    class TestObserver { observe() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', TestObserver);
    try {
      daySheetState.mockClear();
      const realignCalendar = vi.fn();
      const { getByTestId, queryByTestId, findByRole, queryByRole } = render(
        <CalendarBody
          viewMode="month" slides={[new Date('2026-01-01')]}
          renderStart={0} renderEnd={0} emblaRef={vi.fn()}
          tasks={[]} categoriesMap={{}} variant="me"
          dayDetailPresentation="panel" dayPanelSide="left" dayPanelHeight="screen"
          onCalendarLayoutChange={realignCalendar}
          currentUserId="user_1" isActive
          onPrev={vi.fn()} onNext={vi.fn()}
        />
      );
      fireEvent.click(getByTestId('calendar-day'));
      expect(await findByRole('complementary', { name: 'Day details' })).toBeInTheDocument();
      expect(queryByRole('dialog', { name: 'Day details' })).toBeNull();
      const divider = await findByRole('separator', { name: 'Resize day details panel' });
      expect(divider).toHaveAttribute('aria-valuemin', '320');
      const motionHost = getByTestId('day-panel-motion-host');
      expect(motionHost.style.height).toBe('700px');
      fireEvent.transitionEnd(motionHost.firstElementChild as HTMLElement, { propertyName: 'transform' });
      expect(realignCalendar).toHaveBeenCalled();
      expect(daySheetState.mock.calls.at(-1)?.[0]).toMatchObject({
        renderMode: 'panel', isOpen: true,
      });
      const originalPanel = getByTestId('calendar-day-side-panel');
      fireEvent.click(getByTestId('calendar-day'));
      expect(getByTestId('calendar-day-side-panel')).toBe(originalPanel);
      expect(getByTestId('calendar-carousel')).toBeInTheDocument();
      const closeButton = await findByRole('button', { name: 'Close day details' });
      expect(closeButton.closest('.swiper-no-swiping')).not.toBeNull();
      fireEvent.click(closeButton);
      // Exit keeps the same editor mounted until motion completes, but removes interaction immediately.
      expect(getByTestId('day-panel-motion-host')).toHaveAttribute('aria-hidden', 'true');
      await waitFor(() => expect(queryByRole('complementary', { name: 'Day details' })).toBeNull());
      await waitFor(() => expect(queryByTestId('day-panel-motion-host')).toBeNull());
    } finally {
      rect.mockRestore();
      if (original === undefined) vi.unstubAllGlobals();
      else vi.stubGlobal('ResizeObserver', original);
    }
  });

  it('portals screen-height day details beside the Home workspace without moving its headers', async () => {
    const frame = document.createElement('div');
    frame.className = 'mosaic-home-workspace';
    const host = document.createElement('div');
    host.dataset.homePanelSlot = 'true';
    frame.append(host);
    document.body.append(frame);
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: 1400, height: 800, left: 0, right: 1400, top: 0, bottom: 800, x: 0, y: 0, toJSON: () => ({}),
    }));
    class TestObserver { observe() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', TestObserver);
    try {
      const { getByTestId, findByRole, unmount } = render(
        <CalendarBody viewMode="month" slides={[new Date('2026-10-01')]}
          renderStart={0} renderEnd={0} emblaRef={vi.fn()}
          tasks={[]} categoriesMap={{}} variant="me" isActive currentUserId="user_1"
          dayDetailPresentation="panel" dayPanelSide="left" dayPanelHeight="screen"
          onPrev={vi.fn()} onNext={vi.fn()}
        />,
        { container: frame }
      );
      frame.append(host);
      fireEvent.click(getByTestId('calendar-day'));
      expect(await findByRole('complementary', { name: 'Day details' })).toBeInTheDocument();
      await waitFor(() => expect(host.querySelector('[data-day-panel-side="left"]')).not.toBeNull());
      expect(host.querySelector('[data-testid="calendar-day-side-panel"]')).not.toBeNull();
      expect(getByTestId('calendar-carousel')).toBeInTheDocument();
      const motionHost = host.querySelector<HTMLElement>('[data-testid="day-panel-motion-host"]');
      // The panel stops at the visible viewport/nav, not a taller Home frame.
      expect(motionHost?.style.height).toBe(Math.min(800, window.innerHeight) + 'px');
      await waitFor(() => expect(motionHost?.style.width).not.toBe('0px'));
      // The reserved split width stays fixed; only the inner inspector animates.
      expect(motionHost?.style.transition).not.toContain('width');
      expect((motionHost?.firstElementChild as HTMLElement | null)?.style.transition).toContain('transform');
      fireEvent.click(await findByRole('button', { name: 'Close day details' }));
      await waitFor(() => expect(host.querySelector('[data-day-panel-side]')).toBeNull());
      unmount();
    } finally {
      rect.mockRestore();
      vi.unstubAllGlobals();
      frame.remove();
    }
  });
});
