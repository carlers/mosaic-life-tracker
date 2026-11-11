import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShortcutGesture } from '../../src/hooks/useShortcutGesture';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  actionFor: vi.fn((trigger: string) => trigger === 'nav:account' ? 'settings' : null),
}));

vi.mock('../../src/hooks/gestureShortcutsContext', () => ({
  useGestureShortcuts: () => ({ dispatch: mocks.dispatch, actionFor: mocks.actionFor }),
}));
vi.mock('../../src/hooks/useUnreadMessages', () => ({
  useUnreadMessages: () => ({ totalUnread: 0 }),
}));
vi.mock('../../src/hooks/useSharedTasks', () => ({
  useSharedTasks: () => ({ items: [] }),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => true,
}));

import { BottomNav } from '../../src/components/layout/BottomNav';

const touch = (id: number, x: number, y: number) => ({
  identifier: id, clientX: x, clientY: y,
});

function swipe(node: Element, startX: number, startY: number, endX: number, endY: number) {
  fireEvent.touchStart(node, { touches: [touch(1, startX, startY)] });
  fireEvent.touchMove(node, { touches: [touch(1, endX, endY)] });
  fireEvent.touchEnd(node, { touches: [], changedTouches: [touch(1, endX, endY)] });
}

function GestureSurface({ enabled = true, direction = 'up', boundary = 'bottom',
  onTrigger }: {
  enabled?: boolean; direction?: 'up' | 'down'; boundary?: 'top' | 'bottom';
  onTrigger: () => void;
}) {
  const gesture = useShortcutGesture({
    enabled, direction, boundary, onTrigger,
  });
  return (
    <div data-testid="gesture-surface" {...gesture}>
      <button type="button">Existing task action</button>
      <span data-testid="empty-area">Empty scroll area</span>
      <div data-testid="nested-scroll" style={{ overflowY: 'auto' }}>
        <span data-testid="nested-content">Nested native scroller</span>
      </div>
    </div>
  );
}

function setScroll(node: HTMLElement, scrollTop: number, scrollHeight = 520, clientHeight = 200) {
  Object.defineProperties(node, {
    scrollTop: { configurable: true, writable: true, value: scrollTop },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  });
}

beforeEach(() => {
  mocks.dispatch.mockClear();
  mocks.actionFor.mockClear();
});

describe('gesture shortcut ownership', () => {
  it('dispatches once from inactive Me tab without activating Me, but keeps ordinary taps', () => {
    const tabChange = vi.fn();
    render(<BottomNav activeTab="home" onTabChange={tabChange} />);
    const me = screen.getByRole('button', { name: 'Me' });
    fireEvent.click(me);
    expect(tabChange).toHaveBeenCalledWith('account');
    tabChange.mockClear();
    swipe(me, 55, 148, 57, 60);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith('settings');
    fireEvent.click(me);
    expect(tabChange).not.toHaveBeenCalled();
  });

  it('requires true boundary start and release, rejecting ordinary native scrolling', () => {
    const trigger = vi.fn();
    render(<GestureSurface onTrigger={trigger} />);
    const surface = screen.getByTestId('gesture-surface');
    const empty = screen.getByTestId('empty-area');
    setScroll(surface, 120);
    swipe(empty, 20, 180, 20, 60);
    expect(trigger).not.toHaveBeenCalled();
    setScroll(surface, 320);
    fireEvent.touchStart(empty, { touches: [touch(2, 30, 180)] });
    (surface as HTMLElement).scrollTop = 250;
    fireEvent.touchMove(empty, { touches: [touch(2, 30, 90)] });
    (surface as HTMLElement).scrollTop = 320;
    fireEvent.touchEnd(empty, { touches: [], changedTouches: [touch(2, 30, 65)] });
    expect(trigger).not.toHaveBeenCalled();
    swipe(empty, 20, 180, 23, 65);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('keeps a touch gesture after native pointercancel and dispatches only on touchend', () => {
    const trigger = vi.fn();
    render(<GestureSurface onTrigger={trigger} />);
    const surface = screen.getByTestId('gesture-surface');
    setScroll(surface, 320);
    const empty = screen.getByTestId('empty-area');
    fireEvent.touchStart(empty, { touches: [touch(3, 15, 190)] });
    fireEvent.pointerCancel(surface, { pointerType: 'touch', pointerId: 3 });
    fireEvent.touchEnd(empty, { touches: [], changedTouches: [touch(3, 15, 90)] });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('lets a vertically scrollable child own its touch rather than the outer edge', () => {
    const trigger = vi.fn();
    render(<GestureSurface onTrigger={trigger} />);
    const surface = screen.getByTestId('gesture-surface');
    const nested = screen.getByTestId('nested-scroll');
    setScroll(surface, 320);
    setScroll(nested, 200, 500, 100);
    swipe(screen.getByTestId('nested-content'), 20, 190, 20, 80);
    expect(trigger).not.toHaveBeenCalled();
    swipe(screen.getByTestId('empty-area'), 20, 190, 20, 80);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('rejects horizontal swipes, short swipes, wrong directions, and interactive task controls', () => {
    const trigger = vi.fn();
    render(<GestureSurface onTrigger={trigger} />);
    const surface = screen.getByTestId('gesture-surface');
    setScroll(surface, 320);
    const empty = screen.getByTestId('empty-area');
    swipe(empty, 20, 180, 150, 110);
    swipe(empty, 20, 180, 20, 120);
    swipe(empty, 20, 80, 20, 180);
    swipe(screen.getByRole('button', { name: 'Existing task action' }), 20, 180, 20, 70);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('rejects gestures when off or when multiple touch points participate', () => {
    const trigger = vi.fn();
    const { rerender } = render(<GestureSurface enabled={false} onTrigger={trigger} />);
    const surface = screen.getByTestId('gesture-surface');
    setScroll(surface, 320);
    swipe(screen.getByTestId('empty-area'), 20, 180, 20, 65);
    rerender(<GestureSurface onTrigger={trigger} />);
    fireEvent.touchStart(surface, { touches: [touch(1, 20, 180), touch(2, 30, 170)] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(1, 20, 65)] });
    expect(trigger).not.toHaveBeenCalled();
  });
});
