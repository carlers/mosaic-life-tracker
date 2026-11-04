import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyReviewView } from '../../src/components/home/views/DailyReviewView';
import type { ReviewRecord } from '../../src/lib/dailyReviewModel';
import type { DiaryDocument, TaskDocument, CategoryDocument } from '../../src/db/schema';
import { scopeAccountWork } from '../../src/lib/accountWorkScope';

const fixture = vi.hoisted(() => ({
  records: [] as ReviewRecord[],
  addPlan: vi.fn(async () => {}),
  editPlan: vi.fn(async () => {}),
  recordOutcome: vi.fn(async () => {}),
  finishReview: vi.fn(async () => {}),
  addTask: vi.fn(async () => 'new-task'),
  updateTask: vi.fn(async () => {}),
  toggleTaskCompletion: vi.fn(async () => {}),
}));
vi.mock('../../src/hooks/useDailyReview', () => ({
  useDailyReview: () => ({
    records: fixture.records, isLoading: false,
    addPlan: fixture.addPlan, editPlan: fixture.editPlan,
    recordOutcome: fixture.recordOutcome, finishReview: fixture.finishReview,
  }),
}));
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    addTask: fixture.addTask,
    updateTask: fixture.updateTask,
    toggleTaskCompletion: fixture.toggleTaskCompletion,
  }),
}));

const day = new Date(2026, 10, 4);
const category: CategoryDocument = {
  id: 'c1', name: 'Fitness', color: '#63B89A', order: 0,
  visibility: 'private', userId: 'u1', isDeleted: false, updatedAt: '2026-11-04T00:00:00Z',
};
const pending: TaskDocument = {
  id: 't1', title: 'Workout', categoryId: 'c1', order: 0, date: '2026-11-04',
  completed: false, userId: 'u1', isDeleted: false,
  createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z',
  visibility: 'private',
};
const snapshot: ReviewRecord = {
  version: 1, id: 'p1', kind: 'plan', date: '2026-11-04', title: 'Study',
  taskId: '', planId: '', result: '', note: '',
  categoryName: 'School', categoryColor: '#B78AE8',
  plannedAt: '', reviewedAt: '', createdAt: '2026-11-04T08:00:00Z',
};

beforeEach(() => {
  fixture.records = [];
  vi.clearAllMocks();
});

describe('Daily Review unified task workspace', () => {
  it('automatically lists scheduled tasks in Plan without importing them', () => {
    render(<DailyReviewView date={day} tasks={[pending]} categories={[category]}
      userId="u1" onOpenDiary={vi.fn()} />);
    expect(screen.getByLabelText('Plan')).toHaveTextContent('Workout');
    expect(screen.getByLabelText('Plan')).toHaveTextContent('Fitness');
    expect(screen.getByLabelText('Execution')).toHaveTextContent('No completed tasks');
    expect(fixture.addPlan).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Import scheduled tasks' })).toBeNull();
  });

  it('toggles the canonical task instead of writing a duplicate outcome', async () => {
    const onOpenTask = vi.fn();
    const { rerender } = render(<DailyReviewView date={day} tasks={[pending]}
      categories={[category]} userId="u1" onOpenTask={onOpenTask} onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Workout' }));
    expect(onOpenTask).toHaveBeenCalledWith(pending);
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete: Workout' }));
    await waitFor(() => expect(fixture.toggleTaskCompletion).toHaveBeenCalledWith('t1', true));
    expect(fixture.recordOutcome).not.toHaveBeenCalled();
    const done = { ...pending, completed: true, completedAt: '2026-11-04T12:00:00' };
    rerender(<DailyReviewView date={day} tasks={[done]}
      categories={[category]} userId="u1" onOpenTask={onOpenTask} onOpenDiary={vi.fn()} />);
    expect(screen.getByLabelText('Plan')).not.toHaveTextContent('Workout');
    expect(screen.getByLabelText('Execution')).toHaveTextContent('Workout');
    fireEvent.click(screen.getByRole('button', { name: 'Mark incomplete: Workout' }));
    await waitFor(() => expect(fixture.toggleTaskCompletion).toHaveBeenCalledWith('t1', false));
  });

  it('retains exactly three columns and reveals real contents in Overview', () => {
    fixture.records = [snapshot];
    const { container } = render(<DailyReviewView date={day} tasks={[pending]}
      categories={[category]} userId="u1" onOpenDiary={vi.fn()} />);
    const strip = screen.getByTestId('daily-review-stage-strip');
    expect(strip).toHaveAttribute('data-overview', 'true');
    expect(container.querySelectorAll('[data-review-stage]')).toHaveLength(3);
    expect(screen.getByLabelText('Plan')).toHaveTextContent('Workout');
    expect(screen.getByLabelText('Plan')).toHaveTextContent('Study');
    const sections = Array.from(container.querySelectorAll('[data-review-stage]'));
    fireEvent.click(screen.getByLabelText('Execution'));
    expect(strip).not.toHaveAttribute('data-overview', 'true');
    expect(Array.from(container.querySelectorAll('[data-review-stage]'))).toEqual(sections);
    fireEvent.click(screen.getByRole('button', { name: 'Show all three review stages' }));
    expect(strip).toHaveAttribute('data-overview', 'true');
  });

  it('switches section immediately without scrolling any ancestor into view', () => {
    const scroll = vi.fn(), previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<DailyReviewView date={day} tasks={[pending]} categories={[category]}
        userId="u1" onOpenDiary={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus Reflection' }));
      fireEvent.click(screen.getByRole('button', { name: 'Focus Plan' }));
      expect(scroll).not.toHaveBeenCalled();
    } finally { HTMLElement.prototype.scrollIntoView = previous; }
  });

  it('creates new canonical dated tasks using the existing category', async () => {
    render(<DailyReviewView date={day} tasks={[]} categories={[category]}
      userId="u1" onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus Plan' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New plan task' }), {
      target: { value: 'Read a book' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    await waitFor(() => expect(fixture.addTask).toHaveBeenCalledWith({
      title: 'Read a book', date: '2026-11-04', completed: false,
      categoryId: 'c1', visibility: '',
    }));
  });

  it('shows categories inside the task selector and after selecting a task', async () => {
    const other = { ...pending, id: 't2', title: 'Tomorrow run', date: '2026-11-05' };
    render(<DailyReviewView date={day} tasks={[other]} categories={[category]}
      userId="u1" onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus Plan' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Choose task: Choose task' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Fitness · Tomorrow run' }));
    expect(screen.getByRole('combobox', {
      name: 'Choose task: Fitness · Tomorrow run',
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Move to this day' }));
    await waitFor(() => expect(fixture.updateTask).toHaveBeenCalledWith('t2', { date: '2026-11-04' }));
  });

  it('supports editing standalone historical plan items', async () => {
    fixture.records = [snapshot];
    render(<DailyReviewView date={day} tasks={[]} categories={[category]}
      userId="u1" onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan: Study' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit plan item' }), {
      target: { value: 'Study anatomy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fixture.editPlan).toHaveBeenCalledWith('p1', 'Study anatomy'));
  });

  it('keeps independent accomplishments without duplicating completed tasks', async () => {
    fixture.records = [{ ...snapshot, id: 'achievement1', kind: 'execution', result: 'completed' }];
    render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
    expect(screen.getByLabelText('Execution')).toHaveTextContent('Study');
    fireEvent.click(screen.getByRole('button', { name: 'Focus Execution' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Unplanned accomplishment' }), {
      target: { value: 'Helped a friend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add accomplishment' }));
    await waitFor(() => expect(fixture.recordOutcome).toHaveBeenCalledWith(
      '2026-11-04', 'completed', 'Helped a friend'));
  });

  it('pinches in to Overview and out to Focus without stealing ordinary clicks', () => {
    render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus Plan' }));
    const strip = screen.getByTestId('daily-review-stage-strip');
    const touch = (clientX: number) => ({ clientX, clientY: 160 });
    fireEvent.touchStart(strip, { touches: [touch(60), touch(260)] });
    fireEvent.touchMove(strip, { touches: [touch(130), touch(190)] });
    fireEvent.touchEnd(strip, { touches: [] });
    expect(strip).toHaveAttribute('data-overview', 'true');
    fireEvent.touchStart(strip, { touches: [touch(130), touch(190)] });
    fireEvent.touchMove(strip, { touches: [touch(40), touch(270)] });
    fireEvent.touchEnd(strip, { touches: [] });
    expect(strip).not.toHaveAttribute('data-overview', 'true');
  });

  it('edits the existing Diary text without losing visibility, emoji or photos', async () => {
    const entry: DiaryDocument = {
      id: 'diary-day', userId: 'u1', date: '2026-11-04',
      content: 'Before', emoji: '🌿', photos: '["photo-1"]', visibility: 'followers',
      createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z', isDeleted: false,
    };
    const save = vi.fn(async () => {});
    scopeAccountWork('u1');
    render(<DailyReviewView date={day} tasks={[]} diaryEntry={entry}
      userId="u1" onSaveDiary={save} onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus Reflection' }));
    const editor = screen.getByRole('textbox', { name: 'Diary text' });
    expect(editor).toHaveValue('Before');
    fireEvent.change(editor, { target: { value: 'After' } });
    fireEvent.blur(editor);
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      '2026-11-04', 'After', 'followers', '🌿', '["photo-1"]'));
  });
});
