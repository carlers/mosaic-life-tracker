import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  vi.useRealTimers();
});

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

// Regression: §2/§7 (primary-route swipe ownership and direct manipulation).
describe('MainLayout primary route swipes', () => {
  it('animates ordinary tapped routes in either direction without requiring a swipe', () => {
    const common = { activeTab: 'explore' as const, onTabChange: () => {} };
    const { rerender } = render(
      <MainLayout {...common} routeKey="/home" routeTransitionDirection="none">
        <div>Home content</div>
      </MainLayout>
    );
    rerender(
      <MainLayout {...common} routeKey="/explore" routeTransitionDirection="forward">
        <div>Explore content</div>
      </MainLayout>
    );
    expect(screen.getByText('Explore content')).toBeInTheDocument();
    expect(document.querySelector('[data-route-transition-direction="forward"]')).not.toBeNull();
    rerender(
      <MainLayout {...common} routeKey="/home" routeTransitionDirection="backward">
        <div>Home again</div>
      </MainLayout>
    );
    expect(screen.getByText('Home again')).toBeInTheDocument();
    expect(document.querySelector('[data-route-transition-direction="backward"]')).not.toBeNull();
  });

  it('retains the outgoing route during an animated history Back', () => {
    const properties = {
      activeTab: 'messages' as const,
      onTabChange: () => {},
      canSwipeRight: true,
    };
    const { rerender } = render(
      <MainLayout {...properties} routeKey="/messages">
        <div>Messages content</div>
      </MainLayout>
    );
    rerender(
      <MainLayout {...properties} routeKey="/home" animateRouteBack>
        <div>Previous content</div>
      </MainLayout>
    );
    expect(screen.getByText('Previous content')).toBeInTheDocument();
    expect(document.querySelector('[data-route-back-animation="true"]')).not.toBeNull();
  });

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

  it('renders chat detail without bottom nav and accepts only an edge swipe back', () => {
    vi.useFakeTimers();
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout
        activeTab="messages"
        onTabChange={() => {}}
        hideBottomNav
        canSwipeRight
        rightPreview={<div>Messages parent</div>}
        onRouteSwipe={onRouteSwipe}
      >
        <div data-testid="chat-detail">Chat detail</div>
      </MainLayout>
    );

    expect(screen.queryByTestId('bottom-nav')).toBeNull();
    expect(screen.getByText('Chat detail')).toBeInTheDocument();

    drag(screen.getByTestId('chat-detail'), 120, 260);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).not.toHaveBeenCalled();

    drag(screen.getByTestId('chat-detail'), 20, 180);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledWith('right');
  });

  it('supports edge-back detail routes while keeping bottom navigation mounted', () => {
    vi.useFakeTimers();
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout
        activeTab="explore"
        onTabChange={() => {}}
        routeSwipeActivationMode="edge-back"
        canSwipeRight
        rightPreview={<div>Explore parent</div>}
        onRouteSwipe={onRouteSwipe}
      >
        <div data-testid="friend-detail">Friend calendar</div>
      </MainLayout>
    );

    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();

    drag(screen.getByTestId('friend-detail'), 120, 260);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).not.toHaveBeenCalled();

    drag(screen.getByTestId('friend-detail'), 20, 180);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledWith('right');
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

  // Regression: §2 (only the actively dragged adjacent route mounts and appears).
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

  it('routes only an owned dominant horizontal trackpad burst, not scroll or nested carousels', () => {
    vi.useFakeTimers();
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout activeTab="explore" onTabChange={() => {}}
        canSwipeLeft canSwipeRight onRouteSwipe={onRouteSwipe}
        leftPreview={<div>Next</div>}
      >
        <div data-testid="wheel-content">
          <div className="swiper" data-testid="wheel-carousel">Nested carousel</div>
        </div>
      </MainLayout>
    );
    const wheel = (target: Element, deltaX: number, deltaY = 0) =>
      target.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaMode: 0,
        clientX: 120, deltaX, deltaY,
      }));

    expect(wheel(screen.getByTestId('wheel-content'), 24, 100)).toBe(true);
    expect(wheel(screen.getByTestId('wheel-carousel'), 160)).toBe(true);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).not.toHaveBeenCalled();

    expect(wheel(screen.getByTestId('wheel-content'), 50)).toBe(false);
    expect(wheel(screen.getByTestId('wheel-content'), 50)).toBe(false);
    expect(wheel(screen.getByTestId('wheel-content'), 50)).toBe(false);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledTimes(1);
    expect(onRouteSwipe).toHaveBeenCalledWith('left');
  });

  it('holds one continuous wheel gesture across short pauses and tiny trailing deltas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout activeTab="explore" onTabChange={() => {}}
        canSwipeLeft canSwipeRight onRouteSwipe={onRouteSwipe}
        leftPreview={<div>Next</div>}
      >
        <div data-testid="wheel-pause">Trackpad area</div>
      </MainLayout>
    );
    const target = screen.getByTestId('wheel-pause');
    const wheel = (deltaX: number, deltaY = 0) =>
      target.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaMode: 0,
        deltaX, deltaY, clientX: 120,
      }));
    expect(wheel(40)).toBe(false);
    act(() => vi.advanceTimersByTime(160));
    expect(wheel(0.4)).toBe(false);
    act(() => vi.advanceTimersByTime(160));
    expect(onRouteSwipe).not.toHaveBeenCalled();
    expect(wheel(50)).toBe(false);
    act(() => vi.advanceTimersByTime(160));
    expect(onRouteSwipe).not.toHaveBeenCalled();
    expect(wheel(40)).toBe(false);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledOnce();
    expect(onRouteSwipe).toHaveBeenCalledWith('left');
  });

  it('keeps trackpad back edge-only on detail pages', () => {
    vi.useFakeTimers();
    // The previous test committed a navigation; start outside its inertia window.
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const onRouteSwipe = vi.fn();
    render(
      <MainLayout activeTab="messages" onTabChange={() => {}}
        hideBottomNav canSwipeRight onRouteSwipe={onRouteSwipe}
        rightPreview={<div>Parent</div>}
      >
        <div data-testid="wheel-detail">Chat detail</div>
      </MainLayout>
    );
    const target = screen.getByTestId('wheel-detail');
    const wheel = (clientX: number) => {
      // Happy DOM's WheelEvent lacks MouseEvent.clientX; real browsers supply it.
      const event = new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaMode: 0,
        deltaX: -150, deltaY: 0,
      });
      Object.defineProperty(event, 'clientX', { value: clientX });
      return target.dispatchEvent(event);
    };
    expect(wheel(120)).toBe(true);
    expect(wheel(20)).toBe(false);
    act(() => vi.runAllTimers());
    expect(onRouteSwipe).toHaveBeenCalledWith('right');
  });
});
