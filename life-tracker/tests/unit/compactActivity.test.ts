import { describe, expect, it } from 'vitest';
import {
  compactActivityCounts, compactActivityIntensity, compactActivityPeriodMonths,
  compactActivityPeriodStep, compactActivityPeriodTitle, nextCompactActivityZoom,
  resolveCompactActivityZoom,
} from '../../src/lib/compactActivity';
import type { TaskDocument, DiaryDocument } from '../../src/db/schema';

const task = (date: string, categoryId: string, isDeleted = false) =>
  ({ date, categoryId, isDeleted }) as TaskDocument;
const entry = (date: string, isDeleted = false) =>
  ({ date, isDeleted }) as DiaryDocument;

describe('compact activity period and projection', () => {
  it('anchors six-month and year views across the year boundary', () => {
    expect(compactActivityPeriodMonths(new Date(2026, 11, 22), 'half-year')
      .map(date => date.getMonth())).toEqual([6, 7, 8, 9, 10, 11]);
    expect(compactActivityPeriodMonths(new Date(2026, 1, 15), 'year')).toHaveLength(12);
    expect(compactActivityPeriodMonths(new Date(2026, 1, 15), 'year')[0].getMonth()).toBe(0);
    expect(compactActivityPeriodStep('half-year')).toBe(6);
    expect(compactActivityPeriodStep('year')).toBe(12);
    expect(compactActivityPeriodTitle(new Date(2026, 8, 15), 'half-year')).toBe('Jul–Dec 2026');
  });

  it('resolves invalid settings and changes at most one zoom level per step', () => {
    expect(resolveCompactActivityZoom('bad')).toBe('month');
    expect(nextCompactActivityZoom('month', 'out')).toBe('half-year');
    expect(nextCompactActivityZoom('half-year', 'out')).toBe('year');
    expect(nextCompactActivityZoom('year', 'out')).toBe('year');
    expect(nextCompactActivityZoom('year', 'in')).toBe('half-year');
  });

  it('aggregates OR-filtered canonical Todo tasks with valid dates only', () => {
    const tasks = [
      task('2026-02-28', 'a'), task('2026-02-28', 'b'),
      task('2026-02-28', 'c'), task('2026-02-28', 'a', true),
      task('2026-02-30', 'a'), task('nonsense', 'a'),
      task('2024-02-29', 'b'),
    ];
    expect(compactActivityCounts('todo', tasks, [], ['a', 'b']).get('2026-02-28')).toBe(2);
    expect(compactActivityCounts('todo', tasks, [], ['a']).get('2026-02-28')).toBe(1);
    expect(compactActivityCounts('todo', tasks, []).get('2026-02-28')).toBe(3);
    expect(compactActivityCounts('todo', tasks, []).has('2026-02-30')).toBe(false);
    expect(compactActivityCounts('todo', tasks, []).get('2024-02-29')).toBe(1);
  });

  it('counts individual Diary entries without attributing task categories', () => {
    const diary = [entry('2026-01-01'), entry('2026-01-01'), entry('2026-01-02', true)];
    expect(compactActivityCounts('diary', [task('2026-01-01', 'a')], diary, ['missing'])
      .get('2026-01-01')).toBe(2);
    expect(compactActivityCounts('diary', [], diary).has('2026-01-02')).toBe(false);
  });

  it('uses stable zero/one/two-three/four-six/seven-plus intensity bins', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 99].map(compactActivityIntensity))
      .toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});
