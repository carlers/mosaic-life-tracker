import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { TaskDocument } from '../../src/db/schema';
import { makeRouteParentState } from '../../src/lib/primarySwipeNavigation';
import { UncompletedTasksPage } from '../../src/pages/UncompletedTasksPage';

const fixtures = vi.hoisted(() => ({
  toggle: vi.fn(async () => undefined),
  tasks: [] as TaskDocument[],
}));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { $id: 'owner' } }) }));
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: fixtures.tasks, isLoading: false, toggleTaskCompletion: fixtures.toggle }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [{ id: 'cat', userId: 'owner', name: 'Work', color: '#1daaa0', isDeleted: false }], isLoading: false }),
}));

function task(id: string, date: string): TaskDocument {
  return { id, title: id, date, categoryId: 'cat', completed: false,
    order: 0, userId: 'owner', isDeleted: false, visibility: '',
    createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z' };
}

const BacklogSwitch = () => {
  const { search } = useLocation();
  return new URLSearchParams(search).get('view') === 'uncompleted'
    ? <UncompletedTasksPage /> : <div>Backlogs page</div>;
};

describe('Uncompleted Tasks page', () => {
  it('shows owner tasks and completes through the existing hook', async () => {
    fixtures.tasks = [task('undated task', ''), task('other task', '')];
    fixtures.toggle.mockClear();
    render(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Uncompleted Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No date · Backlogs' })).toBeInTheDocument();
    expect(screen.getByLabelText('2 uncompleted tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete undated task' }));
    await waitFor(() => expect(fixtures.toggle).toHaveBeenCalledWith('undated task', true));
  });

  it('opens an undated original task in Backlogs and can return to Me', () => {
    fixtures.tasks = [task('backlog item', '')];
    render(<MemoryRouter initialEntries={['/account', {
      pathname: '/backlog', search: '?view=uncompleted', state: makeRouteParentState('/account'),
    }]} initialIndex={1}>
      <Routes>
        <Route path="/account" element={<div>Me page</div>} />
        <Route path="/backlog" element={<BacklogSwitch />} />
      </Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /backlog item/i }));
    expect(screen.getByText('Backlogs page')).toBeInTheDocument();
  });

  it('opens a dated original task on Home with its exact task and date', () => {
    fixtures.tasks = [task('scheduled item', '2026-11-11')];
    const FocusTarget = () => {
      const { state } = useLocation();
      return <div>Task focus: {state?.focusTaskId} on {state?.focusTaskDate}</div>;
    };
    render(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} />
        <Route path="/home" element={<FocusTarget />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /scheduled item/i }));
    expect(screen.getByText('Task focus: scheduled item on 2026-11-11')).toBeInTheDocument();
  });

  it('returns to Me with a preserved parent, and Home on direct load', () => {
    fixtures.tasks = [];
    const { unmount } = render(<MemoryRouter initialEntries={['/account', {
      pathname: '/backlog', search: '?view=uncompleted', state: makeRouteParentState('/account'),
    }]} initialIndex={1}>
      <Routes><Route path="/account" element={<div>Me page</div>} />
        <Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Me page')).toBeInTheDocument();
    unmount();
    render(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/home" element={<div>Home page</div>} />
        <Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
