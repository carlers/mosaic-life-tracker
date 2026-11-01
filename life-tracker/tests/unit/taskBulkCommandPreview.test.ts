import { describe, expect, it } from 'vitest';
import { previewBulkMoveCommand } from '../../src/lib/taskBulkCommandPreview';
import type { TaskDocument, CategoryDocument } from '../../src/db/schema';

const c = (id: string, name: string, userId = 'owner'): CategoryDocument => ({
  id, name, userId, isDeleted: false, color: 'red', order: 0,
  visibility: 'private', updatedAt: '',
});
const t = (id: string, date: string, completed = false, userId = 'owner'): TaskDocument => ({
  id, date, completed, userId, categoryId: 'school', isDeleted: false, title: id,
  order: 0, createdAt: '', updatedAt: '', visibility: 'private',
});
const cats = [c('school', 'School'), c('projects', 'Projects'), c('foreign', 'School', 'other')];

describe('read-only cross-date bulk selection', () => {
  it('shows completed/unfinished across all dates, including Backlog no-ops, never foreign rows', () => {
    const tasks = [t('today', '2026-11-02'), t('old', '2026-09-01', true), t('backlog', ''), t('other', '', false, 'other')];
    const result = previewBulkMoveCommand('Move all tasks from school to backlogs', 'owner', cats, tasks);
    expect(result?.status).toBe('preview');
    if (result?.status !== 'preview') return;
    expect(result.matches.map(t => t.id).sort()).toEqual(['backlog','old','today']);
    expect(result.noOps.map(t => t.id)).toEqual(['backlog']);
  });
  it('filters only unfinished tasks when explicitly asked', () => {
    const result = previewBulkMoveCommand('Move all uncompleted tasks from School to Projects', 'owner', cats,
      [t('a', '2026-01-01'), t('b', '2026-01-02', true)]);
    expect(result.status).toBe('preview');
    if (result.status !== 'preview') return;
    expect(result.matches.map(t => t.id)).toEqual(['a']);
    expect(result.noOps).toEqual([]);
  });
  it('never guesses ambiguous owner categories or unknown destination', () => {
    expect(previewBulkMoveCommand('move all tasks from School to Never', 'owner', cats, [])?.status).toBe('needs_review');
    expect(previewBulkMoveCommand('move all tasks from School to Backlogs', null, cats, [])?.status).toBe('needs_review');
    expect(previewBulkMoveCommand('move all tasks from School to Backlogs for tomorrow', 'owner', cats, [])?.status).toBe('needs_review');
    expect(previewBulkMoveCommand('complete all tasks', 'owner', cats, [])).toBeNull();
  });
  it('blocks unusual bulk verbs rather than treating them as task creation', () => {
    expect(previewBulkMoveCommand('move the oldest tasks from School to Projects', 'owner', cats, [])?.status)
      .toBe('unsupported');
  });
});
