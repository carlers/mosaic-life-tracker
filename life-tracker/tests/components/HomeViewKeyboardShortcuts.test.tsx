import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHomeViewKeyboardShortcuts } from '../../src/hooks/useHomeViewKeyboardShortcuts';
import type { ViewType } from '../../src/components/home/ViewSwitcher';

function Harness({ active = true }: { active?: boolean }) {
  const [view, setView] = useState<ViewType>('calendar');
  useHomeViewKeyboardShortcuts(active, view, setView);
  return <><output aria-label="Current view">{view}</output><input aria-label="Editor" /></>;
}

describe('Home view keyboard shortcuts', () => {
  it('switches between Todo, Diary and Calendar using the existing view handler', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 't' });
    expect(screen.getByRole('status', { name: 'Current view' })).toHaveTextContent('todo');
    fireEvent.keyDown(document.body, { key: 'd' });
    expect(screen.getByRole('status', { name: 'Current view' })).toHaveTextContent('diary');
    fireEvent.keyDown(document.body, { key: 'v' });
    expect(screen.getByRole('status', { name: 'Current view' })).toHaveTextContent('calendar');
  });
  it('ignores inactive person panes and typing', () => {
    const { rerender } = render(<Harness active={false} />);
    fireEvent.keyDown(document.body, { key: 't' });
    expect(screen.getByRole('status', { name: 'Current view' })).toHaveTextContent('calendar');
    rerender(<Harness active />);
    const input = screen.getByRole('textbox', { name: 'Editor' });
    input.focus();
    fireEvent.keyDown(input, { key: 't' });
    expect(screen.getByRole('status', { name: 'Current view' })).toHaveTextContent('calendar');
    fireEvent.keyDown(input, { key: 'd', ctrlKey: true });
    expect(screen.getByRole('status', { name: 'Current view' })).toHaveTextContent('calendar');
  });
});
