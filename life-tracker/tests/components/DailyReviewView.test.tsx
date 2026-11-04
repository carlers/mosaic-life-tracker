import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyReviewView } from '../../src/components/home/views/DailyReviewView';
import type { ReviewRecord } from '../../src/lib/dailyReviewModel';

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
  plannedAt: '', reviewedAt: '', createdAt: '2026-11-04T08:00:00Z',
};

describe('Daily Review workspace', () => {
  it('shows a continuous three-stage workspace and an accessible overview', () => {
    fixture.records = [plan];
    render(<DailyReviewView date={new Date(2026, 10, 4)} tasks={[]} onOpenDiary={vi.fn()} />);
    expect(screen.getByTestId('daily-review-stage-strip')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan')).toBeInTheDocument();
    expect(screen.getByLabelText('Execution')).toHaveTextContent('Not recorded');
    expect(screen.getByLabelText('Reflection')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all three review stages' }));
    expect(screen.getByTestId('daily-review-overview')).toHaveTextContent('1 planned');
  });
  it('preserves historical plans and records outcomes without silently toggling task completion', () => {
    fixture.records = [plan];
    render(<DailyReviewView date={new Date(2026, 10, 4)} tasks={[]} onOpenDiary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(fixture.recordOutcome).toHaveBeenCalledWith('2026-11-04','completed','Study','t1','p1','');
  });
  it('reuses the existing Diary writer', () => {
    fixture.records = [];
    const open = vi.fn();
    render(<DailyReviewView date={new Date(2026, 10, 4)} tasks={[]} onOpenDiary={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write Diary entry' }));
    expect(open).toHaveBeenCalledOnce();
  });
});
