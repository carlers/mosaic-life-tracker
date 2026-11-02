import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Skip tour' })).toBeVisible();
    expect(screen.getByText('TIP 1 OF 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('TIP 2 OF 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('TIP 1 OF 2')).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Move around your calendar' })).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(finish).toHaveBeenCalledWith('skipped');
    view.unmount();
    expect(button).toHaveFocus();
  });
  it('advances when the user actually opens Day View rather than requiring an unexplained Next tap', async () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const app = document.createElement('div');
    app.dataset.mosaicTour = 'calendar';
    const date = document.createElement('button');
    date.dataset.calendarDay = '2026-11-02';
    date.setAttribute('aria-current', 'date');
    vi.spyOn(date, 'getBoundingClientRect').mockReturnValue({
      left: 30, top: 50, right: 65, bottom: 85, width: 35, height: 35,
    } as DOMRect);
    app.append(date);
    document.body.append(app);
    const view = render(<TourPlayer steps={[
      { title: 'Choose a day', detail: 'Open any date', target: 'date' },
      { title: 'Day View', detail: 'Review the day', target: 'dayview' },
    ]} onFinish={vi.fn()} />);
    expect(screen.getByText('Choose a day')).toBeVisible();
    const dayView = document.createElement('div');
    dayView.dataset.testid = 'day-sheet-swipe-surface';
    vi.spyOn(dayView, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 100, right: 360, bottom: 670, width: 360, height: 570,
    } as DOMRect);
    document.body.append(dayView);
    await waitFor(() => expect(screen.getByText('Day View')).toBeVisible());
    view.unmount();
    app.remove();
    dayView.remove();
  });

  it('does not dismiss the guide when system Back only closes a Day View sheet', () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const finish = vi.fn();
    const view = render(<TourPlayer onFinish={finish} />);
    window.dispatchEvent(new PopStateEvent('popstate', {
      state: { mosaicTourOpen: true },
    }));
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('TIP 2 OF 5')).toBeInTheDocument();
    view.unmount();
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
