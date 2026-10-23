import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { usePrimaryNavigationShortcuts } from '../../src/hooks/usePrimaryNavigationShortcuts';

function ShortcutHarness({ enabled = true, dialog = false }: {
  enabled?: boolean; dialog?: boolean;
}) {
  usePrimaryNavigationShortcuts(enabled);
  const location = useLocation();
  return <div>
    <output aria-label="Route">{location.pathname}</output>
    <input aria-label="Task editor" />
    <button type="button">Other control</button>
    {dialog && <div role="dialog" aria-modal="true">Open sheet</div>}
  </div>;
}
const mount = (enabled = true, dialog = false) => render(
  <MemoryRouter initialEntries={['/home']}><ShortcutHarness enabled={enabled} dialog={dialog} /></MemoryRouter>
);
const press = (key: string, options: Record<string, unknown> = {}) =>
  fireEvent.keyDown(document.body, { key, ...options });

describe('Primary Mosaic keyboard shortcuts', () => {
  it('navigates E, A, C and M to real protected primary routes', () => {
    mount();
    press('e');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/explore');
    press('a');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/notifications');
    press('c');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/messages');
    press('m');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/account');
  });

  it('uses plain H for Home, preserving browser modifiers and shifted keys', () => {
    mount();
    press('e');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/explore');
    press('H', { shiftKey: true });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/explore');
    press('h', { ctrlKey: true });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/explore');
    press('h');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
  });

  it('leaves editor keys, browser modifiers, IME and repeated keys alone', () => {
    mount();
    const input = screen.getByRole('textbox', { name: 'Task editor' });
    input.focus();
    fireEvent.keyDown(input, { key: 'e' });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
    const button = screen.getByRole('button', { name: 'Other control' });
    button.focus();
    fireEvent.keyDown(button, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(button, { key: 'm', shiftKey: true });
    fireEvent.keyDown(button, { key: 'c', isComposing: true });
    fireEvent.keyDown(button, { key: 'e', repeat: true });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
    fireEvent.keyDown(button, { key: 'e' });
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/explore');
  });

  it('does not take route focus while a modal sheet or menu is present', () => {
    mount(true, true);
    press('e');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
  });

  it('does not navigate when the authenticated shortcut controller is disabled', () => {
    mount(false);
    press('e');
    expect(screen.getByRole('status', { name: 'Route' })).toHaveTextContent('/home');
  });
});
