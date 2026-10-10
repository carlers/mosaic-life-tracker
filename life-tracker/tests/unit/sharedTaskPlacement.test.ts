import { describe, expect, it } from 'vitest';
import { parseSharedPlacement, placedShares, placementKey, planSharedTaskMove } from '../../src/lib/sharedTaskPlacement';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';
const item = (id: string): SharedTaskItem => ({
  id, taskId: 'task_' + id, ownerId: 'user_A', inviteeId: 'user_B',
  status: 'accepted', grantEpoch: 'epoch', membershipRevision: 'membership',
  completionRevision: 'revision', title: 'Shared', date: '2026-10-11',
  completed: false,
});
describe('recipient owned placement', () => {
  it('rejects unknown or deleted categories and malicious settings shapes', () => {
    const valid = new Set(['my_category']);
    expect(parseSharedPlacement({ categoryId: 'other_user', order: 0 }, valid)).toBeNull();
    expect(parseSharedPlacement({ categoryId: 'my_category', order: -1 }, valid)).toBeNull();
    expect(parseSharedPlacement({ categoryId: 'my_category', order: 30 }, valid)).toEqual({
      categoryId: 'my_category', order: 30,
    });
  });
  it('groups accepted shares by recipient categories without copying owner private data', () => {
    const valid = new Set(['my_category']);
    const a = item('shr_a'), b = item('shr_b'), c = { ...item('shr_c'), status: 'pending' as const };
    const settings = {
      [placementKey(b.id)]: { categoryId: 'my_category', order: 20 },
      [placementKey(a.id)]: { categoryId: 'my_category', order: 10 },
      [placementKey(c.id)]: { categoryId: 'my_category', order: 5 },
    };
    expect(placedShares([b,c,a],settings,valid).get('my_category')?.map(x=>x.id))
      .toEqual(['shr_a','shr_b']);
  });
  it('places a received share before or after a peer share, not behind every drop', () => {
    const a = item('shr_a'), b = item('shr_b'), c = item('shr_c');
    const rows = [a, b, c];
    const categories = { shr_a: 'cat_B', shr_b: 'cat_B', shr_c: 'cat_B' };
    const orders = { shr_a: 0, shr_b: 10, shr_c: 20 };
    const categoryFor = (share: SharedTaskItem) => categories[share.id as keyof typeof categories];
    const orderFor = (share: SharedTaskItem) => orders[share.id as keyof typeof orders];
    expect(planSharedTaskMove(c, 'cat_B', 'shr_a', 'before',
      rows, categoryFor, orderFor).map(x => x.id))
      .toEqual(['shr_c', 'shr_a', 'shr_b']);
    expect(planSharedTaskMove(a, 'cat_B', 'shr_c', 'after',
      rows, categoryFor, orderFor).map(x => x.id))
      .toEqual(['shr_b', 'shr_c', 'shr_a']);
  });
  it('maps drops on ordinary task rows and native task gaps to the first received row', () => {
    const a = item('shr_a'), b = item('shr_b');
    const categoryFor = (share: SharedTaskItem) =>
      share.id === 'shr_a' ? 'cat_A' : 'cat_B';
    const orderFor = (_share: SharedTaskItem) => 10;
    for (const position of ['before', 'after', 'index', 'start'] as const) {
      const updates = planSharedTaskMove(a, 'cat_B', 'native_task', position,
        [a,b], categoryFor, orderFor);
      expect(updates).toEqual([
        { id: 'shr_a', categoryId: 'cat_B', order: 0 },
        { id: 'shr_b', categoryId: 'cat_B', order: 10 },
      ]);
    }
  });

});
