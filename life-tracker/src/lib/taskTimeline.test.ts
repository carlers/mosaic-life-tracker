import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../db/schema';
import {
  effectiveTaskTimestamp,
  formatTaskTimestamp,
  resolveDayViewMode,
  resolveTimelineDirection,
  resolveTimelineSortBasis,
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
  it('groups completed tasks first and sorts chronologically within each status', () => {
    const original = [older, completed, newer, legacy, invalid];
    expect(sortTasksByTimeline(original, 'desc').map(t => t.id)).toEqual(['b', 'd', 'c', 'a', 'e']);
    expect(sortTasksByTimeline(original, 'asc').map(t => t.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
    expect(original.map(t => t.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('keeps completed tasks contiguous across completion/creation timestamp collisions', () => {
    const completedOld = task('completedOld', '2026-10-20T06:00:00.000Z', true, '2026-10-20T07:00:00.000Z');
    const incompleteMiddle = task('incompleteMiddle', '2026-10-20T11:00:00.000Z');
    const completedNew = task('completedNew', '2026-10-20T08:00:00.000Z', true, '2026-10-20T14:00:00.000Z');
    const incompleteNew = task('incompleteNew', '2026-10-20T15:00:00.000Z');
    const input = [completedOld, incompleteMiddle, completedNew, incompleteNew];
    expect(sortTasksByTimeline(input, 'desc', 'completion').map(t => t.id))
      .toEqual(['completedNew', 'completedOld', 'incompleteNew', 'incompleteMiddle']);
    expect(sortTasksByTimeline(input, 'asc', 'completion').map(t => t.id))
      .toEqual(['completedOld', 'completedNew', 'incompleteMiddle', 'incompleteNew']);
    expect(input.map(t => t.id))
      .toEqual(['completedOld', 'incompleteMiddle', 'completedNew', 'incompleteNew']);
  });
  it('supports completed last with oldest completed at the bottom in newest mode', () => {
    const original = [older, completed, newer, legacy, invalid];
    expect(sortTasksByTimeline(original, 'desc', 'completion-last').map(t => t.id))
      .toEqual(['c', 'a', 'e', 'b', 'd']);
    expect(sortTasksByTimeline(original, 'asc', 'completion-last').map(t => t.id))
      .toEqual(['a', 'c', 'e', 'd', 'b']);
    expect(original.map(t => t.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('can prioritize creation timestamps without mutating the saved task order', () => {
    const original = [older, completed, newer, legacy, invalid];
    expect(sortTasksByTimeline(original, 'desc', 'creation').map(t => t.id))
      .toEqual(['c', 'd', 'a', 'b', 'e']);
    expect(sortTasksByTimeline(original, 'asc', 'creation').map(t => t.id))
      .toEqual(['b', 'a', 'd', 'c', 'e']);
    expect(original.map(t => t.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(effectiveTaskTimestamp(completed, 'creation')).toEqual({
      kind: 'created', value: completed.createdAt
    });
    expect(effectiveTaskTimestamp(task('no-created', 'bad', true, '2026-10-20T12:00:00Z'), 'creation')).toEqual({
      kind: 'completed', value: '2026-10-20T12:00:00Z'
    });
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
    expect(resolveTimelineSortBasis('unexpected')).toBe('completion');
    expect(resolveTimelineSortBasis('creation')).toBe('creation');
    expect(resolveTimelineSortBasis('completion-last')).toBe('completion-last');
  });
});
