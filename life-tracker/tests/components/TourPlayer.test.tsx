import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      state: window.history.state,
    }));
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('TIP 2 OF 5')).toBeInTheDocument();
    view.unmount();
  });

  it('does not skip the date step when Day View was already open or when going Back', async () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const dayView = document.createElement('div');
    dayView.dataset.testid = 'day-sheet-swipe-surface';
    vi.spyOn(dayView, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 120, right: 360, bottom: 640, width: 360, height: 520,
    } as DOMRect);
    document.body.append(dayView);
    const view = render(<TourPlayer steps={[
      { title: 'Start', detail: 'Welcome' },
      { title: 'Choose a date', detail: 'Open a date', target: 'date' },
      { title: 'Review tasks', detail: 'Review Day View', target: 'dayview' },
    ]} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 45)); });
    expect(screen.getByRole('heading', { name: 'Choose a date' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 45)); });
    expect(screen.getByRole('heading', { name: 'Choose a date' })).toBeVisible();
    view.unmount();
    dayView.remove();
  });

  it('does not rewind the browser when users navigate away from the tour', () => {
    const previousRoute = window.location.pathname + window.location.search;
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const finish = vi.fn();
    const view = render(<TourPlayer onFinish={finish} />);
    window.history.replaceState({}, '', '/settings');
    view.unmount();
    expect(back).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledOnce();
    expect(finish).toHaveBeenCalledWith('skipped');
    window.history.replaceState({}, '', previousRoute);
  });

  it('preserves nested sheets when Skip is pressed rather than jumping back two pages', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const finish = vi.fn();
    const view = render(<TourPlayer onFinish={finish} />);
    window.history.replaceState({ ...window.history.state, __mosaicBottomSheetGuard: 'sheet-test' }, '');
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(finish).toHaveBeenCalledWith('skipped');
    expect(go).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(window.history.state?.__mosaicTourGuard).toBeUndefined();
    view.unmount();
    window.history.replaceState({}, '');
  });

  it('recovers when a user hides the highlighted control and can restart', async () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const parent = document.createElement('div');
    const menu = document.createElement('button');
    menu.dataset.homeMenuTrigger = 'true';
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
      left: 10, top: 20, right: 48, bottom: 60, width: 38, height: 40,
    } as DOMRect);
    parent.append(menu);
    document.body.append(parent);
    const view = render(<TourPlayer steps={[
      { title: 'Explore', detail: 'Welcome' },
      { title: 'Menu step', detail: 'Open menu', instruction: 'Tap this menu', target: 'menu' },
    ]} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByText('Tap this menu')).toBeVisible());
    parent.setAttribute('aria-hidden', 'true');
    await waitFor(() => expect(screen.getByText(/explore in any order/i)).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeVisible();
    view.unmount();
    parent.remove();
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
