import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const pausedControls = vi.hoisted(() => new Set<string>());
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (flag: string) => !pausedControls.has(flag),
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => !pausedControls.has(flag),
}));


import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { TaskDocument } from '../../src/db/schema';
import { makeRouteParentState } from '../../src/lib/primarySwipeNavigation';
import { UncompletedTasksPage } from '../../src/pages/UncompletedTasksPage';

const fixtures = vi.hoisted(() => ({
  toggle: vi.fn(async () => undefined),
  tasks: [] as TaskDocument[],
  ownerId: 'owner' as string | null,
}));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: fixtures.ownerId ? { $id: fixtures.ownerId } : null }) }));
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

beforeEach(() => pausedControls.clear());

describe('Uncompleted Tasks page', () => {
  beforeEach(() => { fixtures.ownerId = 'owner'; fixtures.toggle.mockClear(); });
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
  it('filters titles within existing groups, keeps total counts, and handles clear/close', () => {
    fixtures.tasks = [
      task('Late PAPER', '2020-01-01'), task('paper tomorrow', '2099-01-01'),
      task('Unrelated', ''), task('completed paper', '',),
      { ...task('foreign paper', ''), userId: 'another' },
    ];
    fixtures.tasks[3].completed = true;
    render(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>);
    expect(screen.getByLabelText('3 uncompleted tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search uncompleted tasks' }));
    const input = screen.getByRole('searchbox', { name: 'Search uncompleted task titles' });
    fireEvent.change(input, { target: { value: ' pApEr ' } });
    expect(screen.getByText('2 of 3 uncompleted tasks match')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.queryByText('Unrelated')).not.toBeInTheDocument();
    expect(screen.queryByText('foreign paper')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '[paper]' } });
    expect(screen.getByText('No matching uncompleted tasks.')).toBeInTheDocument();
    expect(screen.queryByText('All tasks completed.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear uncompleted task search' }));
    expect(screen.getByText('Unrelated')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'PAPER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close uncompleted task search' }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByText('Unrelated')).toBeInTheDocument();
  });

  it('restores query after a dated-task visit and respects parent Back history', () => {
    fixtures.tasks = [task('research paper', '2099-01-01'), task('other', '')];
    const HomeTarget = () => {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate(-1)}>Return from task</button>;
    };
    render(<MemoryRouter initialEntries={['/account', {
      pathname: '/backlog', search: '?view=uncompleted', state: makeRouteParentState('/account'),
    }]} initialIndex={1}>
      <Routes>
        <Route path="/account" element={<div>Me page</div>} />
        <Route path="/backlog" element={<UncompletedTasksPage />} />
        <Route path="/home" element={<HomeTarget />} />
      </Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Search uncompleted tasks' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'paper' } });
    fireEvent.click(screen.getByRole('button', { name: /research paper/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Return from task' }));
    expect(screen.getByRole('searchbox')).toHaveValue('paper');
    expect(screen.queryByText('other')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Me page')).toBeInTheDocument();
  });

  it('restores search when returning from an undated task', () => {
    fixtures.tasks = [task('backlog paper', ''), task('other', '')];
    const BacklogTarget = () => {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate(-1)}>Return from Backlogs</button>;
    };
    const RouteSwitch = () => {
      const { search } = useLocation();
      return new URLSearchParams(search).get('view') === 'uncompleted'
        ? <UncompletedTasksPage /> : <BacklogTarget />;
    };
    render(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<RouteSwitch />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Search uncompleted tasks' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'paper' } });
    fireEvent.click(screen.getByRole('button', { name: /backlog paper/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Return from Backlogs' }));
    expect(screen.getByRole('searchbox')).toHaveValue('paper');
    expect(screen.queryByText('other')).not.toBeInTheDocument();
  });

  it('does not show another owner\'s saved query or tasks after a change of account', () => {
    fixtures.tasks = [task('owner paper', ''), { ...task('new-owner item', ''), userId: 'another' }];
    const app = () => <MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>;
    const { rerender } = render(app());
    fireEvent.click(screen.getByRole('button', { name: 'Search uncompleted tasks' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'paper' } });
    expect(screen.getByText('owner paper')).toBeInTheDocument();
    fixtures.ownerId = 'another';
    rerender(app());
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText('owner paper')).not.toBeInTheDocument();
    expect(screen.getByText('new-owner item')).toBeInTheDocument();
  });

  it('updates filtered matches when live task completion changes', async () => {
    fixtures.tasks = [task('paper due', ''), task('another paper', '')];
    const element = () => <MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>;
    const { rerender } = render(element());
    fireEvent.click(screen.getByRole('button', { name: 'Search uncompleted tasks' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'paper' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete paper due' }));
    await waitFor(() => expect(fixtures.toggle).toHaveBeenCalledWith('paper due', true));
    fixtures.tasks = fixtures.tasks.map(row => row.id === 'paper due' ? { ...row, completed: true } : row);
    rerender(element());
    expect(screen.getByText('1 of 1 uncompleted tasks match')).toBeInTheDocument();
    expect(screen.queryByText('paper due')).not.toBeInTheDocument();
  });

  it('hides optional search while retaining task access and restores search on re-enable', () => {
    fixtures.tasks = [task('study physics', ''), task('finish work', '')];
    pausedControls.add('mosaic_disable_uncompleted_task_search');
    const { rerender } = render(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Search uncompleted tasks' })).not.toBeInTheDocument();
    expect(screen.getByText('study physics')).toBeInTheDocument();
    pausedControls.clear();
    rerender(<MemoryRouter initialEntries={['/backlog?view=uncompleted']}>
      <Routes><Route path="/backlog" element={<UncompletedTasksPage />} /></Routes>
    </MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Search uncompleted tasks' })).toBeEnabled();
  });

});
