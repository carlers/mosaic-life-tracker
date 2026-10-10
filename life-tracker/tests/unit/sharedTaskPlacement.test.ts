import { describe, expect, it } from 'vitest';
import { parseSharedPlacement, placedShares, placementKey } from '../../src/lib/sharedTaskPlacement';
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
});
