import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyReviewView } from '../../src/components/home/views/DailyReviewView';
import type { ReviewRecord } from '../../src/lib/dailyReviewModel';
import type { DiaryDocument, TaskDocument, CategoryDocument } from '../../src/db/schema';

const fixture = vi.hoisted(() => ({
  records: [] as ReviewRecord[],
  addPlan: vi.fn(async () => {}),
  confirmPlan: vi.fn(async () => {}),
  recordOutcome: vi.fn(async () => {}),
  finishReview: vi.fn(async () => {}),
}));
vi.mock('../../src/hooks/useDailyReview', () => ({
  useDailyReview: () => ({
    records: fixture.records, isLoading: false,
    addPlan: fixture.addPlan, confirmPlan: fixture.confirmPlan,
    recordOutcome: fixture.recordOutcome, finishReview: fixture.finishReview,
  }),
}));
const plan: ReviewRecord = {
  version: 1, id: 'p1', kind: 'plan', date: '2026-11-04',
  title: 'Study', taskId: 't1', planId: '', result: '', note: '',
  categoryName: 'School', categoryColor: '#B78AE8',
  plannedAt: '', reviewedAt: '', createdAt: '2026-11-04T08:00:00Z',
};
const day = new Date(2026, 10, 4);

describe('Daily Review workspace', () => {
  it('keeps the same stage containers while expanding Overview', async () => {
    fixture.records = [plan];
    const { container } = render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
    expect(screen.getByTestId('daily-review-stage-strip')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan')).toHaveTextContent('School');
    expect(screen.getByLabelText('Execution')).toHaveTextContent('Not recorded');
    const original = Array.from(container.querySelectorAll('[data-review-stage]'));
    fireEvent.click(screen.getByRole('button', { name: 'Show all three review stages' }));
    expect(await screen.findByRole('button', { name: 'Focus Reflection' })).toBeInTheDocument();
    expect(screen.getByTestId('daily-review-stage-strip')).toHaveAttribute('data-overview', 'true');
    expect(Array.from(container.querySelectorAll('[data-review-stage]'))).toEqual(original);
  });

  it('never uses ancestor scrollIntoView to focus a stage', async () => {
    fixture.records = [plan];
    const ancestorScroll = vi.fn(), prior = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = ancestorScroll;
    try {
      render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Focus Execution' }));
      fireEvent.click(screen.getByRole('button', { name: 'Focus Reflection' }));
      fireEvent.click(screen.getByRole('button', { name: 'Show all three review stages' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Focus Reflection' }));
      expect(ancestorScroll).not.toHaveBeenCalled();
    } finally { HTMLElement.prototype.scrollIntoView = prior; }
  });

  it('records historical outcomes with category snapshots', () => {
    fixture.records = [plan];
    render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(fixture.recordOutcome).toHaveBeenCalledWith(
      '2026-11-04','completed','Study','t1','p1','','School','#B78AE8');
  });

  it('labels tasks and stores the assigned category for a new dated plan', async () => {
    fixture.records = [];
    const category: CategoryDocument = { id:'c1', name:'Fitness', color:'#63B89A', order:0,
      visibility:'private',userId:'u1',isDeleted:false,updatedAt:'2026-11-04T00:00:00Z' };
    const task: TaskDocument = { id:'t1',title:'Workout',categoryId:'c1',order:0,date:'2026-11-04',
      completed:false,userId:'u1',isDeleted:false,createdAt:'2026-11-04T00:00:00Z',
      updatedAt:'2026-11-04T00:00:00Z',visibility:'private' };
    render(<DailyReviewView date={day} tasks={[task]} categories={[category]} onOpenDiary={vi.fn()} />);
    expect(screen.getByLabelText('Plan')).toHaveTextContent('Fitness');
    fireEvent.click(screen.getByRole('button', { name: /Workout/ }));
    await waitFor(() => expect(fixture.addPlan).toHaveBeenCalledWith(
      '2026-11-04','Workout','t1','Fitness','#63B89A'));
  });

  it('edits existing Diary inline without losing emoji, photos or visibility', async () => {
    fixture.records = [];
    const entry: DiaryDocument = { id:'diary-day',userId:'u1',date:'2026-11-04',
      content:'Before',emoji:'🌿',photos:'["photo-1"]',visibility:'followers',
      createdAt:'2026-11-04T00:00:00Z',updatedAt:'2026-11-04T00:00:00Z',isDeleted:false };
    const save = vi.fn(async () => {});
    render(<DailyReviewView date={day} tasks={[]} diaryEntry={entry}
      userId="u1" onSaveDiary={save} onOpenDiary={vi.fn()} />);
    const editor = screen.getByRole('textbox', { name: 'Diary text' });
    expect(editor).toHaveValue('Before');
    fireEvent.change(editor, { target: { value:'After' } });
    fireEvent.blur(editor);
    await waitFor(() => expect(save).toHaveBeenCalledWith(
      '2026-11-04','After','followers','🌿','["photo-1"]'));
  });
});
