import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../db/schema';
import {
  effectiveTaskTimestamp,
  formatTaskTimestamp,
  resolveDayViewMode,
  resolveTimelineDirection,
  resolveTimestampLabelStyle,
  sortTasksByTimeline,
} from './taskTimeline';

const task = (id: string, createdAt: string, completed = false, completedAt = '') =>
  ({ id, createdAt, completed, completedAt, date: '2026-10-20' }) as TaskDocument;

describe('Day View timeline projection', () => {
  const older = task('a', '2026-10-20T08:00:00.000Z');
  const completed = task('b', '2026-10-20T07:00:00.000Z', true, '2026-10-20T12:00:00.000Z');
  const newer = task('c', '2026-10-20T10:00:00.000Z');
  const legacy = task('d', '2026-10-20T09:00:00.000Z', true);
  const invalid = task('e', 'not-a-date');
  it('sorts by completion time for completed tasks and creation otherwise', () => {
    const original = [older, completed, newer, legacy, invalid];
    expect(sortTasksByTimeline(original, 'desc').map(t => t.id)).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(sortTasksByTimeline(original, 'asc').map(t => t.id)).toEqual(['a', 'd', 'c', 'b', 'e']);
    expect(original.map(t => t.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('falls back to creation and never manufactures completion timestamps', () => {
    expect(effectiveTaskTimestamp(legacy)).toEqual({ kind: 'created', value: legacy.createdAt });
    expect(effectiveTaskTimestamp(invalid)).toBeNull();
    expect(effectiveTaskTimestamp(completed)?.kind).toBe('completed');
  });
  it('uses stable id tie-breaking', () => {
    const a = task('a', older.createdAt);
    const b = task('b', older.createdAt);
    expect(sortTasksByTimeline([b, a], 'desc').map(t => t.id)).toEqual(['a', 'b']);
  });
  it('formats valid times, including date when it differs from the scheduled local day', () => {
    expect(formatTaskTimestamp('bad', '2026-10-20')).toBeNull();
    expect(formatTaskTimestamp('', '2026-10-20')).toBeNull();
    expect(formatTaskTimestamp('2026-10-20T08:00:00.000Z', '')).toMatch(/2026/);
  });
  it('defaults invalid settings safely', () => {
    expect(resolveTimestampLabelStyle('missing')).toBe('icons');
    expect(resolveTimestampLabelStyle('text')).toBe('text');
    expect(resolveDayViewMode('unexpected')).toBe('categories');
    expect(resolveTimelineDirection('unexpected')).toBe('desc');
  });
});
