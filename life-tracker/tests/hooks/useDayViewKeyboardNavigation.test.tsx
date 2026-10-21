import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { isTaskTitleKeyboardTarget, useDayViewKeyboardNavigation } from '../../src/components/home/views/useDayViewKeyboardNavigation';

function Harness({ enabled = true, hideLast = false, selectionMode = false, onHelp }: { enabled?: boolean; hideLast?: boolean; selectionMode?: boolean; onHelp?: () => void }) {
  const { rootRef, onKeyDown, onFocusCapture, onBlurCapture } = useDayViewKeyboardNavigation(enabled, onHelp, !selectionMode);
  return <div ref={rootRef} onKeyDown={onKeyDown}
    onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture} tabIndex={-1}>
    <button data-day-keyboard-target="category" data-day-keyboard-id="work" onClick={() => { const input = document.querySelector<HTMLInputElement>('[aria-label="Add-task editor"]'); input?.focus(); }}>Work</button>
    <button data-day-keyboard-target="task" data-day-keyboard-id="one">First task</button>
    {!hideLast && <button data-day-keyboard-target="task" data-day-keyboard-id="two">Second task</button>}
    <input aria-label="Edit task" />
    <input aria-label="Add-task editor" />
    <button>Other action</button>
  </div>;
}

describe('Day View keyboard browse', () => {
  it('recognizes task-title keyboard activation while preserving other controls', () => {
    const wrapper = document.createElement('div');
    const title = document.createElement('button');
    title.dataset.dayKeyboardTarget = 'task';
    const label = document.createElement('span');
    title.append(label);
    wrapper.append(title);
    expect(isTaskTitleKeyboardTarget(title)).toBe(true);
    expect(isTaskTitleKeyboardTarget(label)).toBe(true);
    expect(isTaskTitleKeyboardTarget(wrapper)).toBe(false);
    expect(isTaskTitleKeyboardTarget(null)).toBe(false);
  });

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

  it('opens the correct rendered category input with N from a task or category, while leaving editors alone', () => {
    render(<Harness />);
    const task = screen.getByRole('button', { name: 'Second task' });
    const add = screen.getByRole('textbox', { name: 'Add-task editor' });
    task.focus();
    expect(fireEvent.keyDown(task, { key: 'n' })).toBe(false);
    expect(add).toHaveFocus();
    const work = screen.getByRole('button', { name: 'Work' });
    work.focus();
    fireEvent.keyDown(work, { key: 'N', shiftKey: true });
    expect(work).toHaveFocus();
    fireEvent.keyDown(work, { key: 'n' });
    expect(add).toHaveFocus();
    fireEvent.keyDown(add, { key: 'n' });
    expect(add).toHaveFocus();
  });

  it('does not add in selection mode or while navigation is disabled', () => {
    const { rerender } = render(<Harness selectionMode />);
    const task = screen.getByRole('button', { name: 'First task' });
    task.focus();
    fireEvent.keyDown(task, { key: 'n' });
    expect(task).toHaveFocus();
    rerender(<Harness enabled={false} />);
    fireEvent.keyDown(task, { key: 'n' });
    expect(task).toHaveFocus();
  });

  it('opens shortcut help with ? only while browsing, preserving ordinary modified shortcuts', () => {
    const onHelp = vi.fn();
    render(<Harness onHelp={onHelp} />);
    const task = screen.getByRole('button', { name: 'First task' });
    task.focus();
    expect(fireEvent.keyDown(task, { key: '?', shiftKey: true })).toBe(false);
    expect(onHelp).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(task, { key: '?', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit task' }), { key: '?', shiftKey: true });
    expect(onHelp).toHaveBeenCalledTimes(1);
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
