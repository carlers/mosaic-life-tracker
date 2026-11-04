import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from '../../src/components/home/ViewSwitcher';

describe('Home view icon dropdown', () => {
  it('shows only the current icon when collapsed and reveals view labels on open', async () => {
    const onViewChange = vi.fn();
    render(<ViewSwitcher activeView="calendar" onViewChange={onViewChange} allowDailyReview />);
    const trigger = screen.getByRole('button', { name: 'View: Calendar' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveTextContent('Calendar');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const daily = await screen.findByRole('menuitemradio', { name: 'Daily Review' });
    fireEvent.click(daily);
    expect(onViewChange).toHaveBeenCalledWith('review');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('keeps private review inaccessible on friend view switchers', async () => {
    render(<ViewSwitcher activeView="calendar" onViewChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    await screen.findByRole('menuitemradio', { name: 'Diary' });
    expect(screen.queryByRole('menuitemradio', { name: 'Daily Review' })).toBeNull();
  });
  it('supports keyboard arrow navigation and Escape with focus recovery', async () => {
    render(<ViewSwitcher activeView="todo" onViewChange={vi.fn()} allowDailyReview />);
    const trigger = screen.getByRole('button', { name: 'View: Todo list' });
    fireEvent.click(trigger);
    const todo = await screen.findByRole('menuitemradio', { name: 'Todo list' });
    todo.focus();
    fireEvent.keyDown(todo, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Diary' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
