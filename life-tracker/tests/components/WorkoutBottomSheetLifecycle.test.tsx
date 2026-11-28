import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutHistorySheet } from '../../src/components/modals/WorkoutHistorySheet';

vi.mock('../../src/hooks/useWorkouts', () => ({
  useWorkouts: () => ({
    userId: 'owner',
    workouts: [{
      id: 'activity_1', userId: 'owner', title: 'Morning Run', sport: 'Run',
      localDate: '2026-11-18', completedAt: '2026-11-18T07:30:00+08:00',
      distanceMeters: 5000, elapsedSeconds: 1740, source: 'synthetic',
      fingerprint: 'f'.repeat(64), categoryId: 'category_1', order: 0,
      createdAt: '2026-11-18T07:30:00+08:00',
      updatedAt: '2026-11-18T07:30:00+08:00', isDeleted: false,
    }],
    links: [], tasks: [], isLoading: false,
  }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{id: 'category_1', userId: 'owner', name: 'Workout', color: '#F59E0B',
      visibility:'private', order: 0, isDeleted:false}],
    addCategory: vi.fn().mockResolvedValue('created_category'),
  }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: () => '', setSetting: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, height, pullDownToDismiss, onClose, onExitComplete, children }: {
    isOpen: boolean; title: string; height?: string; pullDownToDismiss?: boolean;
    onClose: () => void; onExitComplete?: () => void; children: React.ReactNode;
  }) => <section role="dialog" aria-label={title} data-open={String(isOpen)}
    data-height={height} data-pull-down={String(pullDownToDismiss)}>
    {children}
    <button type="button" onClick={onClose} aria-label={`Dismiss ${title}`}>Dismiss</button>
    <button type="button" onClick={onExitComplete} aria-label={`Finish exit ${title}`}>Exit complete</button>
  </section>,
}));

describe('workout native bottom-sheet behavior', () => {
  it('uses the standard bottom-height scroll/pull surface and retains focused content during close', () => {
    const onClose = vi.fn();
    const onExit = vi.fn();
    const props = { date: '2026-11-18', focusActivityId: 'activity_1',
      onClose, onFocusedDetailsExit: onExit };
    const view = render(<WorkoutHistorySheet {...props} isOpen/>);
    const details = screen.getByRole('dialog', {name: 'Workout details'});
    expect(details).toHaveAttribute('data-open', 'true');
    expect(details).toHaveAttribute('data-height', 'auto');
    expect(details).toHaveAttribute('data-pull-down', 'true');
    expect(screen.getByRole('heading', {name: 'Morning Run'})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Dismiss Workout details'}));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(<WorkoutHistorySheet {...props} isOpen={false}/>);
    expect(details).toHaveAttribute('data-open', 'false');
    // The editor stays in the portal until the shared slide-down exit completes.
    expect(screen.getByRole('heading', {name: 'Morning Run'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Finish exit Workout details'}));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('keeps the history-selected workout alive through the close animation', () => {
    const onClose = vi.fn();
    render(<WorkoutHistorySheet isOpen onClose={onClose}/>);
    const history = screen.getByRole('dialog', {name: 'Workout history'});
    expect(history).toHaveAttribute('data-height', 'auto');
    expect(history).toHaveAttribute('data-pull-down', 'true');

    fireEvent.click(screen.getByRole('button', {name: 'Open workout Morning Run'}));
    const details = screen.getByRole('dialog', {name: 'Workout details'});
    expect(details).toHaveAttribute('data-open', 'true');

    fireEvent.click(screen.getByRole('button', {name: 'Dismiss Workout details'}));
    expect(details).toHaveAttribute('data-open', 'false');
    expect(screen.getByRole('heading', {name: 'Morning Run'})).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Finish exit Workout details'}));
    expect(screen.queryByRole('heading', {name: 'Morning Run'})).toBeNull();
  });
});
