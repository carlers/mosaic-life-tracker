import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/layout/BottomNav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav">Bottom nav</nav>,
}));

vi.mock('../../src/pages/AccountPage', () => ({
  AccountPage: () => <div>Actual Me neighbor content</div>,
}));
vi.mock('../../src/pages/ExplorePage', () => ({
  ExplorePage: () => <div>Actual Explore neighbor content</div>,
}));
vi.mock('../../src/pages/HomePage', () => ({
  HomePage: () => <div>Actual Home neighbor content</div>,
}));
vi.mock('../../src/pages/MessagesPage', () => ({
  MessagesPage: () => <div>Actual Chat neighbor content</div>,
}));
vi.mock('../../src/pages/SettingsPage', () => ({
  SettingsPage: () => <div>Actual Settings neighbor content</div>,
}));
vi.mock('../../src/components/layout/ComingSoon', () => ({
  ComingSoon: () => <div>Actual Alerts neighbor content</div>,
}));

import { MainLayout } from '../../src/components/layout/MainLayout';
import { PrimaryRoutePreview } from '../../src/components/layout/PrimaryRoutePreview';

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
  it('keeps Home full-height, ignores body swipes, and accepts the hamburger-layer swipe', () => {
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

  it('can render a detail route without bottom navigation or its content inset', () => {
    render(
      <MainLayout
        activeTab="messages"
        onTabChange={() => {}}
        hideBottomNav
      >
        <div>Chat detail</div>
      </MainLayout>
    );

    expect(screen.queryByTestId('bottom-nav')).toBeNull();
    expect(screen.getByText('Chat detail')).toBeInTheDocument();
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

  // Regression: PROJECT_REFERENCE.md §2 — an adjacent route becomes visible only for
  // the active gesture; it must not mount during the initial critical render.
  it('mounts only the directional destination preview during a live drag', () => {
    vi.useFakeTimers();
    const Preview = vi.fn(() => (
      <div data-testid="left-route-preview">Next page</div>
    ));

    render(
      <MainLayout
        activeTab="explore"
        onTabChange={() => {}}
        canSwipeLeft
        canSwipeRight
        onRouteSwipe={() => {}}
        leftPreview={<Preview />}
        rightPreview={<div data-testid="right-route-preview">Previous page</div>}
      >
        <div data-testid="explore-body">Explore</div>
      </MainLayout>
    );

    expect(screen.queryByTestId('left-route-preview')).toBeNull();
    expect(screen.queryByTestId('right-route-preview')).toBeNull();
    expect(Preview).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByTestId('explore-body'), {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 100,
      button: 0,
    });
    fireEvent.pointerMove(screen.getByTestId('explore-body'), {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 220,
      clientY: 102,
    });

    expect(screen.getByTestId('left-route-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('right-route-preview')).toBeNull();
    expect(Preview).toHaveBeenCalledTimes(1);
  });


  it('renders the prefetched adjacent route content when its chunk is ready', async () => {
    render(<PrimaryRoutePreview pathname="/account" />);
    expect(
      await screen.findByText('Actual Me neighbor content')
    ).toBeInTheDocument();
  });
});
