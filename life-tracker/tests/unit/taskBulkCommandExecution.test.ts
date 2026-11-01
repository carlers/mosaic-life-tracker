import { describe, expect, it } from 'vitest';
import type { TaskDocument, CategoryDocument } from '../../src/db/schema';
import { executeMovePlan, undoMovePlan, type BulkMovePlan, type BulkMoveStore } from '../../src/lib/taskBulkCommandExecution';

const task = (id: string): TaskDocument => ({
  id, userId: 'owner', categoryId: 'school', date: '2026-11-02',
  title: id, order: 0, completed: false, createdAt: '', updatedAt: '2026-11-01T12:00:00.000Z',
  visibility: 'public', isDeleted: false,
});
function setup(ids: string[] = ['a', 'b', 'c']) {
  const tasks = new Map(ids.map(id => [id, task(id)]));
  let owner = 'owner';
  const categories = new Map<string, CategoryDocument>([
    ['school', { id: 'school', userId: 'owner', name: 'School',
      color: 'red', visibility: 'private', isDeleted: false, order: 0, updatedAt: '' }],
    ['projects', { id: 'projects', userId: 'owner', name: 'Projects',
      color: 'red', visibility: 'private', isDeleted: false, order: 0, updatedAt: '' }],
  ]);
  const store: BulkMoveStore = {
    currentOwner: () => owner,
    readTask: async id => tasks.get(id) ?? null,
    readCategory: async id => categories.get(id) ?? null,
    comparePatch: async (before, patch) => {
      const current = tasks.get(before.id);
      if (!current || current.updatedAt !== before.updatedAt ||
          current.userId !== before.userId || current.categoryId !== before.categoryId ||
          current.date !== before.date || current.visibility !== before.visibility ||
          current.completed !== before.completed || current.isDeleted) return false;
      tasks.set(before.id, { ...current, ...patch });
      return true;
    },
  };
  const plan: BulkMovePlan = { ownerId: 'owner', sourceCategoryId: 'school',
    destination: { type: 'backlogs' }, rows: ids.map(id => {
      const { id: key, userId, categoryId, date, completed, updatedAt, visibility, isDeleted } = tasks.get(id)!;
      return { id: key, userId, categoryId, date, completed, updatedAt, visibility, isDeleted };
    }),
  };
  return { tasks, categories, store, plan, changeOwner: (id: string) => { owner = id; } };
}
describe('guarded bulk move core (not wired to UI)', () => {
  it('privatizes Backlogs and undoes only matching post-write rows', async () => {
    const { tasks, plan, store } = setup(['a']);
    const result = await executeMovePlan(plan, store);
    expect(result.applied).toHaveLength(1);
    expect(tasks.get('a')?.date).toBe('');
    expect(tasks.get('a')?.visibility).toBe('private');
    const undone = await undoMovePlan(plan, result, store);
    expect(undone.applied).toHaveLength(1);
    expect(tasks.get('a')?.date).toBe('2026-11-02');
    expect(tasks.get('a')?.visibility).toBe('public');
  });
  it('isolates conflict and refuses undo following edits or account change', async () => {
    const { tasks, plan, store, changeOwner } = setup(['a', 'b']);
    tasks.set('a', { ...tasks.get('a')!, updatedAt: 'changed' });
    const result = await executeMovePlan(plan, store);
    expect(result.conflicts).toEqual(['a']);
    expect(result.applied).toHaveLength(1);
    tasks.set('b', { ...tasks.get('b')!, updatedAt: 'changed-again' });
    expect((await undoMovePlan(plan, result, store)).conflicts).toEqual(['b']);
    changeOwner('other');
    await expect(executeMovePlan(plan, store)).rejects.toThrow('Account changed');
  });
  it('reports partial failure and cancellation with progress', async () => {
    const { plan, store } = setup();
    const original = store.comparePatch;
    store.comparePatch = async (before, after) => {
      if (before.id === 'b') throw Error('Offline');
      return original(before, after);
    };
    const steps: number[] = [];
    const result = await executeMovePlan(plan, store, {
      onProgress: count => steps.push(count),
      cancelled: () => steps.length >= 2,
    });
    expect(result.applied.map(x => x.before.id)).toEqual(['a']);
    expect(result.failures).toEqual(['b']);
    expect(result.cancelled).toBe(true);
    expect(steps).toEqual([1,2]);
  });
  it('validates destination and refuses duplicate or oversized batches', async () => {
    const { plan, store, categories } = setup(['a']);
    plan.destination = { type: 'category', categoryId: 'projects' };
    categories.set('projects', { ...categories.get('projects')!, isDeleted: true });
    await expect(executeMovePlan(plan, store)).rejects.toThrow('Destination category changed');
    plan.destination = { type: 'backlogs' };
    plan.rows.push(plan.rows[0]);
    await expect(executeMovePlan(plan, store)).rejects.toThrow('Invalid move batch');
  });
});
