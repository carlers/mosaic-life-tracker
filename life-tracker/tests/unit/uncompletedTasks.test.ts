import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../../src/db/schema';
import { filterUncompletedSections, groupUncompletedTasks, isScheduledDateKey } from '../../src/lib/uncompletedTasks';

function task(id: string, date: string, changes: Partial<TaskDocument> = {}): TaskDocument {
  return {
    id, title: id, date, completed: false, categoryId: 'cat',
    order: 0, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
    userId: 'owner', isDeleted: false, visibility: '', ...changes,
  };
}

describe('uncompleted owner projection', () => {
  const today = '2026-10-21';
  it('includes old, today, future and unscheduled without moving or mutating tasks', () => {
    const source = [task('older', '2026-10-19'), task('today', today),
      task('future', '2026-11-02'), task('backlog', '')];
    const sections = groupUncompletedTasks(source, 'owner', today);
    expect(sections.map(s => [s.id, s.tasks.map(t => t.id)])).toEqual([
      ['overdue', ['older']], ['today', ['today']], ['upcoming', ['future']], ['backlog', ['backlog']],
    ]);
    expect(source[0].date).toBe('2026-10-19');
  });

  it('never leaks another user, completed or tombstoned tasks', () => {
    const rows = [
      task('visible', today), task('other', today, { userId: 'another' }),
      task('done', today, { completed: true }),
      task('removed', today, { isDeleted: true }),
    ];
    expect(groupUncompletedTasks(rows, 'owner', today).flatMap(s => s.tasks.map(t => t.id))).toEqual(['visible']);
    expect(groupUncompletedTasks(rows, undefined, today)).toEqual([]);
  });

  it('uses stable chronological order, saved order, then creation and id as tie breaks', () => {
    const rows = [
      task('old', '2026-10-01'), task('recent', '2026-10-20'),
      task('later', '2026-12-01'), task('soon', '2026-11-01'),
      task('second', today, { order: 2 }),
      task('first', today, { order: 0 }),
    ];
    const sections = groupUncompletedTasks(rows, 'owner', today);
    expect(sections.map(s => s.tasks.map(t => t.id))).toEqual([
      ['recent', 'old'], ['first', 'second'], ['soon', 'later'],
    ]);
  });

  it('isolates malformed dates rather than silently treating them as backlog', () => {
    expect(isScheduledDateKey('2026-02-30')).toBe(false);
    expect(isScheduledDateKey('2026-10-21')).toBe(true);
    const sections = groupUncompletedTasks([task('bad', '2026-02-30')], 'owner', today);
    expect(sections[0].id).toBe('unknown');
    expect(sections[0].tasks[0].date).toBe('2026-02-30');
  });
});

describe('uncompleted title search', () => {
  const today = '2026-10-21';
  const original = groupUncompletedTasks([
    task('Late PAPER', '2026-10-19'),
    task('paper tomorrow', '2026-10-22'),
    task('Write homework', today),
    task('No-date paper', ''),
    task('Literal [paper]', '2026-10-18'),
    task('not visible paper', today, { userId: 'other' }),
    task('completed paper', today, { completed: true }),
    task('deleted paper', today, { isDeleted: true }),
    task('bad paper date', '2026-02-30'),
  ], 'owner', today);

  it('filters titles case-insensitively without rank sorting, mutation or owner leaks', () => {
    const before = original.map(section => [section.id, section.tasks.map(t => t.id)]);
    const visible = filterUncompletedSections(original, '  PAPER ');
    expect(visible.map(section => [section.id, section.tasks.map(t => t.id)])).toEqual([
      ['overdue', ['Late PAPER', 'Literal [paper]']],
      ['upcoming', ['paper tomorrow']],
      ['backlog', ['No-date paper']],
      ['unknown', ['bad paper date']],
    ]);
    expect(original.map(section => [section.id, section.tasks.map(t => t.id)])).toEqual(before);
  });

  it('matches literal punctuation, omits empty groups, and returns all groups for blank query', () => {
    expect(filterUncompletedSections(original, '[paper]').flatMap(section => section.tasks.map(t => t.id)))
      .toEqual(['Literal [paper]']);
    expect(filterUncompletedSections(original, 'not present')).toEqual([]);
    expect(filterUncompletedSections(original, '  ')).toBe(original);
  });
});
