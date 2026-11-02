import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { KeyboardShortcutsProvider } from '../../src/hooks/KeyboardShortcutsProvider';
import { useKeyboardShortcuts } from '../../src/hooks/keyboardShortcutsContext';

const mockSettings = vi.hoisted(() => ({ enabled: true, isLoading: false }));
const mockFeature = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => mockFeature.enabled,
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    isLoading: mockSettings.isLoading,
    getSetting: (key: string, fallback: unknown) =>
      key === 'keyboardShortcutsEnabled' ? mockSettings.enabled : fallback,
  }),
}));
vi.mock('../../src/components/ui/KeyboardShortcutsSheet', () => ({
  KeyboardShortcutsSheet: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button type="button" onClick={onClose}>Close guide</button>
    </div>
  ),
}));
function Body() {
  const location = useLocation();
  const { enabled, openGuide } = useKeyboardShortcuts();
  return <><output aria-label="Route">{location.pathname}</output>
    <output aria-label="Enabled">{enabled ? 'on' : 'off'}</output>
    <button type="button" onClick={openGuide}>Guide in preferences</button>
  </>;
}
const mount = () => render(<MemoryRouter initialEntries={['/home']}>
  <KeyboardShortcutsProvider><Body /></KeyboardShortcutsProvider>
</MemoryRouter>);

describe('Account-scoped keyboard shortcut preference and guide', () => {
  beforeEach(() => { mockSettings.enabled = true; mockSettings.isLoading = false; mockFeature.enabled = true; });
  it('opens ? help and routes when enabled', async () => {
    mount();
    fireEvent.keyDown(document.body, { key: '?' , shiftKey: true });
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close guide' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/explore');
  });
  it('stops letter and ? shortcuts immediately on opt-out, but guide stays discoverable', async () => {
    const ui = mount();
    mockSettings.enabled = false;
    ui.rerender(<MemoryRouter initialEntries={['/home']}>
      <KeyboardShortcutsProvider><Body /></KeyboardShortcutsProvider>
    </MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Enabled' })).toHaveTextContent('off');
    fireEvent.keyDown(document.body, { key: 'e' });
    fireEvent.keyDown(document.body, { key: '?' , shiftKey: true });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guide in preferences' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });
  it('honors an operator kill switch and restores saved user preference without navigation', () => {
    const ui = mount();
    expect(screen.getByRole('status', { name: 'Enabled' })).toHaveTextContent('on');
    mockFeature.enabled = false;
    ui.rerender(<MemoryRouter initialEntries={['/home']}>
      <KeyboardShortcutsProvider><Body /></KeyboardShortcutsProvider>
    </MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Enabled' })).toHaveTextContent('off');
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
    expect(mockSettings.enabled).toBe(true);
    mockFeature.enabled = true;
    ui.rerender(<MemoryRouter initialEntries={['/home']}>
      <KeyboardShortcutsProvider><Body /></KeyboardShortcutsProvider>
    </MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Enabled' })).toHaveTextContent('on');
  });

  it('does not activate shortcuts before settings finish loading', () => {
    mockSettings.isLoading = true;
    mount();
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
  });
});
