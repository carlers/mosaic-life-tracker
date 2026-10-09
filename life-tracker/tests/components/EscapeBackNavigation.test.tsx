import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (_key: string, fallback: boolean) => mocks.enabled ?? fallback,
  }),
}));

import { EscapeBackNavigation } from '../../src/components/layout/EscapeBackNavigation';

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EscapeBackNavigation />
      <Routes>
        <Route path="/home" element={<p>Home route</p>} />
        <Route path="/messages" element={<p>Messages route</p>} />
        <Route path="/settings" element={<p>Settings route</p>} />
        <Route path="/settings/preferences" element={<p>Preferences route</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function escape(target: Element | Window = window) {
  await act(async () => { fireEvent.keyDown(target, { key: 'Escape' }); });
}

beforeEach(() => {
  mocks.enabled = true;
  window.history.replaceState({ idx: 0 }, '');
});
afterEach(() => {
  document.getElementById('test-overlay')?.remove();
  vi.restoreAllMocks();
});

describe('optional route Escape navigation', () => {
  it('does not navigate when the preference is off', async () => {
    mocks.enabled = false;
    mount('/settings/preferences');
    await escape();
    expect(screen.getByText('Preferences route')).toBeInTheDocument();
  });

  it('resolves direct detail routes to their documented parent without leaving the app', async () => {
    mount('/settings/preferences');
    await escape();
    expect(screen.getByText('Settings route')).toBeInTheDocument();
  });

  it('returns a direct primary route to Home and does not exit the root', async () => {
    mount('/messages');
    await escape();
    expect(screen.getByText('Home route')).toBeInTheDocument();
    await escape();
    expect(screen.getByText('Home route')).toBeInTheDocument();
  });

  it('respects editable controls and an existing handler that prevents Escape', async () => {
    mount('/settings/preferences');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await escape(input);
    expect(screen.getByText('Preferences route')).toBeInTheDocument();
    input.remove();
    const ownEscape = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener('keydown', ownEscape);
    await escape();
    window.removeEventListener('keydown', ownEscape);
    expect(screen.getByText('Preferences route')).toBeInTheDocument();
  });

  it('does not navigate beneath a visible modal layer', async () => {
    mount('/settings/preferences');
    const overlay = document.createElement('div');
    overlay.id = 'test-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.append(overlay);
    await escape();
    expect(screen.getByText('Preferences route')).toBeInTheDocument();
  });

  it('consumes Home search history before attempting route navigation', async () => {
    mount('/home');
    window.history.replaceState({ mosaicHomeSearch: true, idx: 1 }, '');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    await escape();
    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Home route')).toBeInTheDocument();
  });
});
