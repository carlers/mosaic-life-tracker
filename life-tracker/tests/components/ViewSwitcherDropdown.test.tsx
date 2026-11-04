import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from '../../src/components/home/ViewSwitcher';

describe('Home view icon picker', () => {
  it('keeps the compact active icon and opens native labeled view options', () => {
    const onViewChange = vi.fn();
    render(<ViewSwitcher activeView="calendar" onViewChange={onViewChange} allowDailyReview />);
    const picker = screen.getByRole('combobox', { name: 'Choose Home view' });
    expect(picker).toHaveValue('calendar');
    expect(within(picker).getByRole('option', { name: 'Daily Review' })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: 'review' } });
    expect(onViewChange).toHaveBeenCalledWith('review');
  });
  it('excludes private review from a friend profile picker', () => {
    render(<ViewSwitcher activeView="calendar" onViewChange={vi.fn()} />);
    const picker = screen.getByRole('combobox', { name: 'Choose Home view' });
    expect(within(picker).queryByRole('option', { name: 'Daily Review' })).toBeNull();
  });
  it('retains native keyboard focus and selects a requested view', () => {
    const onViewChange = vi.fn();
    render(<ViewSwitcher activeView="todo" onViewChange={onViewChange} allowDailyReview />);
    const picker = screen.getByRole('combobox', { name: 'Choose Home view' });
    picker.focus();
    expect(picker).toHaveFocus();
    fireEvent.change(picker, { target: { value: 'diary' } });
    expect(onViewChange).toHaveBeenCalledWith('diary');
  });
});
