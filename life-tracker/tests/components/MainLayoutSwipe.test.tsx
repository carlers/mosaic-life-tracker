import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/layout/BottomNav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav">Bottom nav</nav>,
}));

import { MainLayout } from '../../src/components/layout/MainLayout';
import { AppearanceContext } from '../../src/hooks/appearanceContext';

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

    expect(screen.getByRole('main')).not.toHaveClass('pb-24');
    expect(screen.getByTestId('primary-route-content')).toHaveClass(
      'pb-[calc(4rem+env(safe-area-inset-bottom))]'
    );
    expect(screen.getByTestId('primary-route-swipe-surface')).toHaveClass(
      'h-full',
      'min-h-0'
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
    expect(screen.getByTestId('primary-route-content')).not.toHaveClass(
      'pb-[calc(4rem+env(safe-area-inset-bottom))]'
    );
  });

  it('keeps the non-Home swipe surface at least as tall as the full route viewport', () => {
    render(
      <MainLayout
        activeTab="explore"
        onTabChange={() => {}}
        canSwipeLeft
        canSwipeRight
        onRouteSwipe={() => {}}
      >
        <div>Short Explore content</div>
      </MainLayout>
    );

    expect(screen.getByTestId('primary-route-swipe-surface')).toHaveClass(
      'min-h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]'
    );
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

  // Regression: task acceptance — Comfortable content width constrains the shared route surface,
  // not individual pages, so live swipe previews stay attached inside the same centered frame.
  it('constrains the shared route frame in Comfortable mode on larger screens', () => {
    render(
      <AppearanceContext.Provider
        value={{
          mode: 'system',
          resolvedTheme: 'dark',
          setAppearanceMode: vi.fn().mockResolvedValue(undefined),
          contentWidthMode: 'comfortable',
          sheetWidthMode: 'full',
          setContentWidthMode: vi.fn().mockResolvedValue(undefined),
          setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <MainLayout
          activeTab="explore"
          onTabChange={() => {}}
          canSwipeLeft
          canSwipeRight
          onRouteSwipe={() => {}}
        >
          <div>Explore body</div>
        </MainLayout>
      </AppearanceContext.Provider>
    );

    expect(screen.getByTestId('primary-route-width-frame')).toHaveClass(
      'w-full',
      'md:w-[min(70vw,960px)]',
      'md:mx-auto'
    );
  });

  it('constrains the shared route frame to 85vw in Wide mode on larger screens', () => {
    render(
      <AppearanceContext.Provider
        value={{
          mode: 'system',
          resolvedTheme: 'dark',
          setAppearanceMode: vi.fn().mockResolvedValue(undefined),
          contentWidthMode: 'wide',
          sheetWidthMode: 'full',
          setContentWidthMode: vi.fn().mockResolvedValue(undefined),
          setSheetWidthMode: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <MainLayout
          activeTab="explore"
          onTabChange={() => {}}
          canSwipeLeft
          canSwipeRight
          onRouteSwipe={() => {}}
        >
          <div>Explore body</div>
        </MainLayout>
      </AppearanceContext.Provider>
    );

    expect(screen.getByTestId('primary-route-width-frame')).toHaveClass(
      'w-full',
      'md:w-[85vw]',
      'md:mx-auto'
    );
  });

});
