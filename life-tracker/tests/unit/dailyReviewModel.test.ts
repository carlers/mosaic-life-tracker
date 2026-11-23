import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import {
  outcomeForPlan, planForDay, executionForDay, parseReviewRecord, validReviewDate, reviewTaskPlacement,
  type ReviewRecord
} from '../../src/lib/dailyReviewModel';

const make = (id: string, date: string, kind: ReviewRecord['kind'], extras: Partial<ReviewRecord> = {}): ReviewRecord => ({
  version: 1, id, kind, date, title: 'Research', taskId: 'task-1', planId: '',
  result: '', note: '', plannedAt: '', reviewedAt: '',
  createdAt: '2026-11-02T09:00:00.000Z', ...extras,
});

describe('Daily Review historical contracts', () => {
  it('keeps multiple dated plans for one canonical task independent', () => {
    const monday = make('p1', '2026-11-02', 'plan');
    const tuesday = make('p2', '2026-11-03', 'plan');
    const wednesday = make('p3', '2026-11-04', 'plan');
    const execution = make('e3', '2026-11-04', 'execution', {
      planId: 'p3', result: 'completed', createdAt: '2026-11-04T15:00:00.000Z'
    });
    const records = [monday, tuesday, wednesday, execution];
    expect(outcomeForPlan(records, monday, true)).toBe('not-recorded');
    expect(outcomeForPlan(records, tuesday, true)).toBe('not-recorded');
    expect(outcomeForPlan(records, wednesday, true)).toBe('completed');
    expect(planForDay(records, '2026-11-02')).toEqual([monday]);
    expect(executionForDay(records, '2026-11-04')).toEqual([execution]);
  });
  it('distinguishes unrecorded work from explicitly missed work', () => {
    const plan = make('p', '2026-11-02', 'plan');
    expect(outcomeForPlan([plan], plan, false)).toBe('not-recorded');
    expect(outcomeForPlan([plan], plan, true)).toBe('not-recorded');
    const missed = make('m', plan.date, 'execution', {planId: plan.id,result:'missed'});
    expect(outcomeForPlan([plan,missed], plan, true)).toBe('missed');
    const correction = make('e', plan.date, 'execution', {planId: plan.id,result:'partial'});
    expect(outcomeForPlan([plan,correction], plan, true)).toBe('partial');
  });
  it('preserves unplanned accomplishments without fabricating plans', () => {
    const execution = make('e', '2026-11-04', 'execution', {planId:'',taskId:'',result:'completed'});
    expect(planForDay([execution], execution.date)).toHaveLength(0);
    expect(executionForDay([execution], execution.date)).toEqual([execution]);
  });

  it('places dated tasks consistently across completion and undo, independent of completion day', () => {
    const task = {
      id: 'task-1', title: 'Workout', date: '2026-11-04',
      completed: false, completedAt: '', isDeleted: false,
    } as TaskDocument;
    expect(reviewTaskPlacement(task, '2026-11-04')).toBe('plan');
    const completedLater = { ...task, completed: true, completedAt: '2026-11-05T10:00:00Z' };
    expect(reviewTaskPlacement(completedLater, '2026-11-04')).toBe('execution');
    expect(reviewTaskPlacement(completedLater, '2026-11-05')).toBe('completed-elsewhere');
    expect(reviewTaskPlacement({ ...completedLater, completed: false, completedAt: '' }, '2026-11-04')).toBe('plan');
    expect(reviewTaskPlacement({ ...completedLater, completed: false, completedAt: '' }, '2026-11-05')).toBeNull();
    expect(reviewTaskPlacement({ ...completedLater, isDeleted: true }, '2026-11-04')).toBeNull();
  });

  it('validates calendar dates and rejects malformed serialized records', () => {
    expect(validReviewDate('2026-02-29')).toBe(false);
    expect(validReviewDate('2028-02-29')).toBe(true);
    const record = make('daily_review_v1_p_20261104_test', '2026-11-04', 'plan');
    expect(parseReviewRecord(record.id, JSON.stringify(record))).toEqual(record);
    const snapshot = { ...record, categoryName: 'Original category', categoryColor: '#123456' };
    expect(parseReviewRecord(record.id, JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseReviewRecord(record.id, JSON.stringify({ ...record, categoryColor: 99 }))).toBeNull();
    expect(parseReviewRecord(record.id, '{bad-json')).toBeNull();
    expect(parseReviewRecord('other', JSON.stringify(record))).toBeNull();
  });
});
