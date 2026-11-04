import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyReviewView } from '../../src/components/home/views/DailyReviewView';
import type { ReviewRecord } from '../../src/lib/dailyReviewModel';
import type { DiaryDocument, TaskDocument, CategoryDocument } from '../../src/db/schema';
import { scopeAccountWork } from '../../src/lib/accountWorkScope';

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

  it('offers binary Done / Undo only, preserving legacy partial history as Not done', () => {
    fixture.records = [plan, {
      ...plan, id: 'legacy-outcome', kind: 'execution', planId: 'p1',
      result: 'partial', createdAt: '2026-11-04T10:00:00Z',
    }];
    const { rerender } = render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
    expect(screen.getByLabelText('Execution')).toHaveTextContent('Not done');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    for (const label of ['Partial', 'Missed', 'Cancelled']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
    fixture.records = [plan, {
      ...plan, id: 'completed-outcome', kind: 'execution', planId: 'p1',
      result: 'completed', createdAt: '2026-11-04T12:00:00Z',
    }];
    rerender(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(fixture.recordOutcome).toHaveBeenCalledWith(
      '2026-11-04', 'missed', 'Study', 't1', 'p1', '', 'School', '#B78AE8');
  });

  it('pinches inward to Overview and outward to focused stages without a mouse button', () => {
    fixture.records = [plan];
    render(<DailyReviewView date={day} tasks={[]} onOpenDiary={vi.fn()} />);
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

  it('edits existing Diary inline without losing emoji, photos or visibility', async () => {
    fixture.records = [];
    const entry: DiaryDocument = { id:'diary-day',userId:'u1',date:'2026-11-04',
      content:'Before',emoji:'🌿',photos:'["photo-1"]',visibility:'followers',
      createdAt:'2026-11-04T00:00:00Z',updatedAt:'2026-11-04T00:00:00Z',isDeleted:false };
    const save = vi.fn(async () => {});
    scopeAccountWork('u1');
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
