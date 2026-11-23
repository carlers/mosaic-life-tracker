import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import { getLocalTodayKey } from '../../src/lib/todayWidget';

const mocks = vi.hoisted(() => ({
  toggle: vi.fn(),
  openToday: vi.fn(),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner' } }),
}));
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: (enabled: boolean) => {
    if (enabled !== false) throw new Error('Widgets must not subscribe to tasks independently');
    return { toggleTaskCompletion: mocks.toggle };
  },
}));

import { WidgetsPage } from '../../src/components/home/WidgetsPage';

const category: CategoryDocument = {
  id: 'cat', name: 'Personal', color: '#5E83CE', order: 0,
  visibility: 'private', userId: 'owner', isDeleted: false, updatedAt: '',
};
const row = (overrides: Partial<TaskDocument> = {}): TaskDocument => ({
  id: 'task', title: 'Read book', date: getLocalTodayKey(),
  userId: 'owner', categoryId: 'cat', order: 1, completed: false,
  createdAt: '', updatedAt: '', visibility: 'private', isDeleted: false,
  ...overrides,
});

beforeEach(() => {
  mocks.openToday.mockReset();
  mocks.toggle.mockReset();
  mocks.toggle.mockResolvedValue(undefined);
});

describe('Today widget', () => {
  it('only presents completion as an editable task control and reflects owner snapshot progress', async () => {
    const { rerender } = render(<WidgetsPage tasks={[row()]} categories={[category]} onOpenToday={mocks.openToday} />);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: "Today's task progress" }))
      .toHaveAttribute('aria-valuetext', '0 of 1 tasks complete');
    expect(screen.getByRole('checkbox', { name: 'Read book' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: /edit|delete|add/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Read book' }));
    await waitFor(() => expect(mocks.toggle).toHaveBeenCalledWith('task', true));

    rerender(<WidgetsPage tasks={[row({ completed: true })]} categories={[category]} onOpenToday={mocks.openToday} />);
    expect(screen.getByRole('checkbox', { name: 'Read book' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('progressbar', { name: "Today's task progress" }))
      .toHaveAttribute('aria-valuetext', '1 of 1 tasks complete');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Read book' }));
    await waitFor(() => expect(mocks.toggle).toHaveBeenCalledWith('task', false));
  });

  it('ignores other owners and dates, and renders an empty task state', () => {
    render(<WidgetsPage tasks={[row({ userId: 'other' }), row({ id: 'future', date: '2099-01-01' })]} categories={[category]} onOpenToday={mocks.openToday} />);
    expect(screen.getByText('No tasks today')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('opens the owner Calendar from the card, progress and task title, never from the checkbox', () => {
    render(<WidgetsPage tasks={[row()]} categories={[category]} onOpenToday={mocks.openToday} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open today in Calendar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open today in Calendar: Read book' }));
    fireEvent.click(screen.getByRole('progressbar'));
    expect(mocks.openToday).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Read book' }));
    expect(mocks.openToday).toHaveBeenCalledTimes(3);
    expect(mocks.toggle).toHaveBeenCalledWith('task', true);
  });

  it('does not mistake a horizontal or vertical pan for a card tap', () => {
    render(<WidgetsPage tasks={[row()]} categories={[category]} onOpenToday={mocks.openToday} />);
    const card = screen.getByRole('region', { name: 'Today' });
    fireEvent.pointerDown(card, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 100 });
    fireEvent.pointerMove(card, { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 103 });
    fireEvent.click(card);
    expect(mocks.openToday).not.toHaveBeenCalled();
    fireEvent.pointerDown(card, { pointerId: 2, pointerType: 'touch', clientX: 80, clientY: 100 });
    fireEvent.pointerMove(card, { pointerId: 2, pointerType: 'touch', clientX: 82, clientY: 150 });
    fireEvent.click(card);
    expect(mocks.openToday).not.toHaveBeenCalled();
  });

  it('disables the active checkbox while the existing completion operation is pending', async () => {
    let resolve!: () => void;
    mocks.toggle.mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
    render(<WidgetsPage tasks={[row()]} categories={[category]} onOpenToday={mocks.openToday} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Read book' });
    fireEvent.click(checkbox);
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(mocks.toggle).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(checkbox).not.toBeDisabled());
  });

  it('keeps the row actionable and reports failed local writes without changing progress', async () => {
    mocks.toggle.mockRejectedValueOnce(new Error('local write failed'));
    render(<WidgetsPage tasks={[row()]} categories={[category]} onOpenToday={mocks.openToday} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Read book' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update task');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('checkbox', { name: 'Read book' })).not.toBeDisabled();
  });
});
