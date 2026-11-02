import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourPlayer } from '../../src/components/onboarding/TourPlayer';
import { readTourOutcome, recordTourOutcome, tourKey } from '../../src/lib/tourProgress';

describe('guided tour controls', () => {
  afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });
  it('exposes step progress, Back, Skip, and final completion without writing tasks', () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const finish = vi.fn();
    const view = render(<TourPlayer steps={[
      { title: 'Calendar', detail: 'Explore calendar' },
      { title: 'Tasks', detail: 'Explore tasks' },
    ]} onFinish={finish} />);
    expect(screen.getByRole('dialog', { name: 'Mosaic guided tour' })).toBeInTheDocument();
    expect(screen.getByText('MOSAIC TOUR · 1 OF 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('MOSAIC TOUR · 2 OF 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('MOSAIC TOUR · 1 OF 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(finish).toHaveBeenCalledWith('completed');
    view.unmount();
  });
  it('supports Escape dismissal and keyboard-focus restoration', () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const finish = vi.fn();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const view = render(<TourPlayer onFinish={finish} />);
    expect(screen.getByRole('heading', { name: 'Find your way around' })).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(finish).toHaveBeenCalledWith('skipped');
    view.unmount();
    expect(button).toHaveFocus();
  });
  it('records optional account-specific state without affecting other accounts', () => {
    const a = tourKey('a'), b = tourKey('b');
    localStorage.removeItem(a);
    localStorage.removeItem(b);
    recordTourOutcome(a, 'skipped');
    expect(readTourOutcome(a)).toBe('skipped');
    expect(readTourOutcome(b)).toBeNull();
    recordTourOutcome(a, 'completed');
    expect(readTourOutcome(a)).toBe('completed');
    localStorage.removeItem(a);
  });
});
