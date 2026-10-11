import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BacklogPage } from '../../src/pages/BacklogPage';
import { makeRouteParentState } from '../../src/lib/primarySwipeNavigation';

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: ({ renderMode, focusTaskId }: { renderMode: string; focusTaskId?: string | null }) => (
    <div data-testid="backlog-workspace" data-mode={renderMode} data-focus-task-id={focusTaskId ?? ''} />
  ),
}));

describe('Backlogs page navigation', () => {
  it('opens the date-free day workspace and returns to its Me-page parent', () => {
    render(
      <MemoryRouter initialEntries={['/account', {
        pathname: '/backlog',
        state: { ...makeRouteParentState('/account'), focusTaskId: 'task_abc' },
      }]} initialIndex={1}>
        <Routes>
          <Route path="/account" element={<div>Me page</div>} />
          <Route path="/backlog" element={<BacklogPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Backlogs' })).toBeInTheDocument();
    expect(screen.getByTestId('backlog-workspace')).toHaveAttribute('data-mode', 'backlog');
    expect(screen.getByTestId('backlog-workspace')).toHaveAttribute('data-focus-task-id', 'task_abc');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Me page')).toBeInTheDocument();
  });

  it('falls back to Home when Backlogs is opened directly', () => {
    render(
      <MemoryRouter initialEntries={['/backlog']}>
        <Routes>
          <Route path="/home" element={<div>Home page</div>} />
          <Route path="/backlog" element={<BacklogPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
