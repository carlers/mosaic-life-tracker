import { describe, expect, it } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import { commandDateWindow, commandTargetDate, selectCommandTasks } from '../../src/lib/taskCommandScopes';

const now = new Date(2026, 10, 15, 12); // Sunday
const cat = (id: string, name: string, userId = 'owner'): CategoryDocument =>
  ({ id, name, userId, order: 0, color: '#ffffff', visibility: 'private',
    isDeleted: false, updatedAt: '' });
const categories = [cat('school','School'), cat('family','Family'),
  cat('foreign','School','other')];
const task = (id: string, categoryId: string, date: string, userId = 'owner'): TaskDocument =>
  ({id, categoryId, date, userId, title:id, completed:false, isDeleted:false,
    visibility:'private', order:0, createdAt:'',updatedAt:'2026-11-15T00:00:00Z'});

describe('bounded relative-day and multi-category task scope', () => {
  it('uses local calendar Monday-to-Sunday ranges and next Monday, not a rolling seven days', () => {
    expect(commandDateWindow('last week',now)).toMatchObject({
      start:'2026-11-02',end:'2026-11-09',
    });
    expect(commandTargetDate('next Monday',now)).toBe('2026-11-16');
    expect(commandTargetDate('next Monday', new Date(2026,10,16,12))).toBe('2026-11-23');
    expect(commandDateWindow('on 2026-02-31',now)).toBeNull();
  });
  it('matches only own School tasks, ignores other categories and accounts', () => {
    const result = selectCommandTasks('my School tasks', 'owner', categories,
      [task('mine','school','2026-11-02'),task('family','family','2026-11-02'),
        task('other','school','2026-11-02','other')], now);
    expect(result.status).toBe('preview');
    if (result.status === 'preview') expect(result.selection.matches.map(t=>t.id)).toEqual(['mine']);
  });
  it('selects only last-week tasks across owner categories and ignores adjacent dates', () => {
    const selected = selectCommandTasks('my tasks from last week','owner',categories,[
      task('early','school','2026-11-01'),task('a','school','2026-11-02'),
      task('b','family','2026-11-08'),task('late','school','2026-11-09'),
      task('foreign','school','2026-11-05','other'),
    ],now);
    expect(selected.status).toBe('preview');
    if(selected.status==='preview')expect(selected.selection.matches.map(t=>t.id)).toEqual(['a','b']);
  });
  it('does not guess a category or allow date-less account-wide selections', () => {
    expect(selectCommandTasks('my tasks','owner',categories,[],now).status).toBe('needs_review');
    expect(selectCommandTasks('Nonexistent tasks today','owner',categories,[],now).status).toBe('needs_review');
    expect(selectCommandTasks('my School tasks today',null,categories,[],now).status).toBe('needs_review');
  });
});
