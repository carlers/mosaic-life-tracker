import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from '../../src/components/home/ViewSwitcher';

describe('Mosaic Home view picker', () => {
  it('shows only the active icon closed and opens the shared Mosaic listbox', async () => {
    const onViewChange = vi.fn();
    render(<ViewSwitcher activeView="calendar" onViewChange={onViewChange} allowDailyReview />);
    const trigger = screen.getByRole('button', { name: 'Choose Home view' });
    expect(trigger).not.toHaveTextContent('Calendar');
    fireEvent.click(trigger);
    expect(await screen.findByRole('combobox', { name: /Choose Home view: Calendar/ })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: 'Daily Review' }));
    expect(onViewChange).toHaveBeenCalledWith('review');
  });
  it('keeps private Review out of friend selection', async () => {
    render(<ViewSwitcher activeView="calendar" onViewChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Home view' }));
    expect(await screen.findByRole('option', { name: 'Diary' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Daily Review' })).toBeNull();
  });
  it('has Mosaic keyboard handling and Escape restores focus', async () => {
    render(<ViewSwitcher activeView="todo" onViewChange={vi.fn()} allowDailyReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Home view' }));
    const trigger = await screen.findByRole('combobox', { name: /Choose Home view: Todo list/ });
    const list = await screen.findByRole('listbox', { name: 'Choose Home view' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Diary' })).toHaveFocus();
    fireEvent.keyDown(list, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('listbox', { name: 'Choose Home view' })).toBeNull();
  });
});
