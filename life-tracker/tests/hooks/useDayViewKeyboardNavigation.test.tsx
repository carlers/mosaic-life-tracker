import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useDayViewKeyboardNavigation } from '../../src/components/home/views/useDayViewKeyboardNavigation';

function Harness({ enabled = true, hideLast = false }: { enabled?: boolean; hideLast?: boolean }) {
  const nav = useDayViewKeyboardNavigation(enabled);
  return <div ref={nav.rootRef} onKeyDown={nav.onKeyDown}
    onFocusCapture={nav.onFocusCapture} onBlurCapture={nav.onBlurCapture} tabIndex={-1}>
    <button data-day-keyboard-target="category" data-day-keyboard-id="work">Work</button>
    <button data-day-keyboard-target="task" data-day-keyboard-id="one">First task</button>
    {!hideLast && <button data-day-keyboard-target="task" data-day-keyboard-id="two">Second task</button>}
    <input aria-label="Edit task" />
    <button>Other action</button>
  </div>;
}

describe('Day View keyboard browse', () => {
  it('traverses only the designated category and task targets in rendered order', () => {
    render(<Harness />);
    const category = screen.getByRole('button', { name: 'Work' });
    const first = screen.getByRole('button', { name: 'First task' });
    const second = screen.getByRole('button', { name: 'Second task' });
    category.focus();
    expect(fireEvent.keyDown(category, { key: 'ArrowDown' })).toBe(false);
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'End' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'Home' });
    expect(category).toHaveFocus();
    fireEvent.keyDown(category, { key: 'ArrowUp' });
    expect(category).toHaveFocus();
  });

  it('preserves text caret, browser modifiers, and disabled navigation', () => {
    const { rerender } = render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Edit task' });
    const first = screen.getByRole('button', { name: 'First task' });
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveFocus();
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown', ctrlKey: true });
    expect(first).toHaveFocus();
    rerender(<Harness enabled={false} />);
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(first).toHaveFocus();
  });

  it('restores focus to a nearby visible target if the keyboard-focused task disappears', async () => {
    const { rerender } = render(<Harness />);
    const second = screen.getByRole('button', { name: 'Second task' });
    const first = screen.getByRole('button', { name: 'First task' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    rerender(<Harness hideLast />);
    await waitFor(() => expect(first).toHaveFocus());
  });

  it('does not intercept events originating from other controls', () => {
    const onClick = vi.fn();
    render(<><Harness /><button onClick={onClick}>Outside</button></>);
    const other = screen.getByRole('button', { name: 'Other action' });
    other.focus();
    fireEvent.keyDown(other, { key: 'ArrowDown' });
    expect(other).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
