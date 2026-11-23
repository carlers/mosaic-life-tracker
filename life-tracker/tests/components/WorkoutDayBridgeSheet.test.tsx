import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkoutDayBridge from '../../src/components/home/views/WorkoutDayBridge';

const { emptyRows } = vi.hoisted(() => ({ emptyRows: [] }));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner' } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: emptyRows, isLoading: false }),
}));
vi.mock('../../src/components/modals/WorkoutHistorySheet', () => ({
  default: ({ isOpen, onClose, onFocusedDetailsExit }: {
    isOpen: boolean;
    onClose: () => void;
    onFocusedDetailsExit: () => void;
  }) => <div data-testid="focused-workout-sheet" data-open={String(isOpen)}>
    <button type="button" onClick={onClose}>Close workout sheet</button>
    <button type="button" onClick={onFocusedDetailsExit}>Finish workout exit</button>
  </div>,
}));

describe('Day View workout sheet lifecycle', () => {
  it('keeps the bottom sheet mounted and closed until the exit transition finishes', async () => {
    const onUpdate = vi.fn();
    render(<WorkoutDayBridge dateStr="2026-11-18" currentUserId="owner"
      tasks={[]} categories={[]} onUpdate={onUpdate} />);
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    act(() => {
      onUpdate.mock.lastCall?.[0].onOpenWorkout('activity_1');
    });
    expect(await screen.findByTestId('focused-workout-sheet')).toHaveAttribute('data-open', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Close workout sheet' }));
    // The old implementation unmounted immediately and could not play an exit animation.
    expect(screen.getByTestId('focused-workout-sheet')).toHaveAttribute('data-open', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Finish workout exit' }));
    await waitFor(() => expect(screen.queryByTestId('focused-workout-sheet')).toBeNull());
  });

  it('does not unmount if another workout opens before the prior exit settles', async () => {
    const onUpdate = vi.fn();
    render(<WorkoutDayBridge dateStr="2026-11-18" currentUserId="owner"
      tasks={[]} categories={[]} onUpdate={onUpdate}/>);
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    act(() => { onUpdate.mock.lastCall?.[0].onOpenWorkout('activity_1'); });
    expect(await screen.findByTestId('focused-workout-sheet')).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close workout sheet' }));
    act(() => { onUpdate.mock.lastCall?.[0].onOpenWorkout('activity_2'); });
    fireEvent.click(screen.getByRole('button', { name: 'Finish workout exit' }));
    expect(screen.getByTestId('focused-workout-sheet')).toHaveAttribute('data-open','true');
  });
});
