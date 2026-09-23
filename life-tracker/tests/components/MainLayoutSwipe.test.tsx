import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/layout/BottomNav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav">Bottom nav</nav>,
}));

import { MainLayout } from '../../src/components/layout/MainLayout';

function drag(target: Element, fromX: number, toX: number) {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: fromX,
    clientY: 100,
    button: 0,
  });
  fireEvent.pointerMove(target, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: toX,
    clientY: 104,
  });
  fireEvent.pointerUp(target, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: toX,
    clientY: 104,
  });
}

// Regression: PROJECT_REFERENCE.md §2 — primary route swipes are direct page gestures,
// with Home restricted to its hamburger layer and Me left-swipe opening Settings.
describe('MainLayout primary route swipes', () => {
  it('ignores Home body swipes but accepts a left swipe from the hamburger layer', () => {
    vi.useFakeTimers();
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout
        activeTab="home"
        onTabChange={() => {}}
        canSwipeLeft
        canSwipeRight={false}
        onRouteSwipe={onRouteSwipe}
      >
        <div data-testid="home-body">
          <div data-route-swipe-zone="home-to-explore" data-testid="hamburger-layer">
            Menu layer
          </div>
        </div>
      </MainLayout>
    );

    drag(screen.getByTestId('home-body'), 300, 80);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).not.toHaveBeenCalled();

    drag(screen.getByTestId('hamburger-layer'), 300, 80);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledWith('left');
  });

  it('accepts a leftward full-page swipe on Me', () => {
    vi.useFakeTimers();
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout
        activeTab="account"
        onTabChange={() => {}}
        canSwipeLeft
        canSwipeRight
        onRouteSwipe={onRouteSwipe}
      >
        <div data-testid="me-body">Me</div>
      </MainLayout>
    );

    drag(screen.getByTestId('me-body'), 300, 80);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledWith('left');
  });

  // Regression: PROJECT_REFERENCE.md §2 — non-Home swipe ownership includes the bottom inset/content wrapper.
  it('keeps the bottom navigation inset inside the draggable route surface', () => {
    render(
      <MainLayout
        activeTab="explore"
        onTabChange={() => {}}
        canSwipeLeft
        canSwipeRight
        onRouteSwipe={() => {}}
      >
        <div>Explore body</div>
      </MainLayout>
    );

    const surface = screen.getByTestId('primary-route-swipe-surface');
    const content = screen.getByTestId('primary-route-content');
    expect(surface).toContainElement(content);
    expect(content).toHaveClass(
      'pb-[calc(4rem+env(safe-area-inset-bottom))]'
    );
  });
});
