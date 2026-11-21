import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { NavigateFunction } from 'react-router-dom';
import HomeKeyboardShortcutBridge from '../../src/lib/HomeKeyboardShortcutBridge';

vi.mock('../../src/hooks/keyboardShortcutsContext', () => ({
  useKeyboardShortcuts: () => ({ enabled: false }),
}));
vi.mock('../../src/lib/homeShortcutRegistration', () => ({
  registerHomeShortcuts: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const makeProps = () => ({
  taskSearchEnabled: true,
  isSearchOpen: false,
  isSettingsOpen: false,
  searchDaySheetOpen: false,
  friendCarouselRef: React.createRef<HTMLDivElement>(),
  handleOpenBacklog: vi.fn(),
  handleOpenSearch: vi.fn(),
  navigate: vi.fn() as unknown as NavigateFunction,
  setMenuShortcut: vi.fn(),
  setViewShortcut: vi.fn(),
  setActivePersonId: vi.fn(),
});

describe('Home route gesture bridge', () => {
  it('consumes a Home menu intent exactly once even if keyboard state changes', async () => {
    const props = makeProps();
    const state = { mosaicGestureRequest: 'categories' };
    const { rerender } = render(
      <HomeKeyboardShortcutBridge {...props} routeState={state} routeKey="route-1" />
    );
    await waitFor(() => {
      expect(props.setMenuShortcut).toHaveBeenCalledWith({ key: 'route-1', action: 'categories' });
    });
    expect(props.navigate).toHaveBeenCalledWith('/home', { replace: true, state: null });
    rerender(
      <HomeKeyboardShortcutBridge {...props} routeState={state} routeKey="route-1" isSearchOpen />
    );
    expect(props.setMenuShortcut).toHaveBeenCalledTimes(1);
  });

  it('retains the correct route key and owner selection for a view intent', async () => {
    const props = makeProps();
    render(
      <HomeKeyboardShortcutBridge {...props}
        routeState={{ mosaicGestureRequest: 'diary' }} routeKey="route-2" />
    );
    await waitFor(() => expect(props.setViewShortcut)
      .toHaveBeenCalledWith({ key: 'route-2', view: 'diary' }));
    expect(props.setActivePersonId).toHaveBeenCalledWith('me');
    expect(props.navigate).toHaveBeenCalledWith('/home', { replace: true, state: null });
    expect(props.handleOpenSearch).not.toHaveBeenCalled();
  });
});
