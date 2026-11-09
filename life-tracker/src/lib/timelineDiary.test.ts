import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../db/schema';
import type { TimelineGroup } from './timelinePlanner';
import { diaryPlacementFromTimelineDrop, resolveTimelineDiarySlot } from './timelineDiary';
import { diarySlotIndex } from './diaryPlacement';

const task = (id: string, categoryId = 'one', order = 0): TaskDocument => ({
  id, categoryId, order, userId: 'owner', date: '2026-11-10',
  createdAt: '2026-11-10T09:00:00Z', updatedAt: '', title: id,
  completed: false, isDeleted: false, visibility: 'private',
});
const owned = [task('a', 'one', 0), task('b', 'one', 1), task('c', 'two', 0)];
const groups: TimelineGroup[] = [
  { id: 'morning', label: 'Morning', tasks: [owned[0], owned[2]] },
  { id: 'night', label: 'Night', tasks: [owned[1]] },
  { id: '', label: 'Unassigned', tasks: [] },
];

describe('Timeline Diary shares Categories diary placement', () => {
  it('uses the saved top or bottom position without a new Timeline setting', () => {
    expect(resolveTimelineDiarySlot({ kind: 'top' }, groups, owned, 'bottom')).toEqual({ kind: 'top' });
    expect(resolveTimelineDiarySlot({ kind: 'bottom' }, groups, owned, 'top')).toEqual({ kind: 'bottom' });
    expect(resolveTimelineDiarySlot({ kind: 'slot', categoryId: 'missing', index: 0 }, groups, owned, 'bottom'))
      .toEqual({ kind: 'bottom' });
  });

  it('projects existing category task anchors into the matching Timeline section', () => {
    expect(resolveTimelineDiarySlot({ kind: 'before', categoryId: 'one', taskId: 'b', index: 1 }, groups, owned, 'top'))
      .toEqual({ kind: 'before', taskId: 'b' });
    expect(resolveTimelineDiarySlot({ kind: 'slot', categoryId: 'one', index: 1 }, groups, owned, 'top'))
      .toEqual({ kind: 'after', taskId: 'a' });
    expect(resolveTimelineDiarySlot({ kind: 'after', categoryId: 'one', taskId: 'gone', index: 2 }, groups, owned, 'top'))
      .toEqual({ kind: 'after', taskId: 'b' });
  });

  it('maps Timeline diary drops back to Categories relative task anchors', () => {
    // The shared category placement format canonically anchors this slot after 'a'.
    const beforeB = diaryPlacementFromTimelineDrop('planner-before:b', groups, owned);
    expect(beforeB).toEqual({ kind: 'after', categoryId: 'one', taskId: 'a', index: 1 });
    expect(diarySlotIndex(beforeB!, ['a', 'b'])).toBe(1);
    expect(diarySlotIndex(beforeB!, ['a', 'new', 'b'])).toBe(1);
    expect(diaryPlacementFromTimelineDrop('planner-after:a', groups, owned))
      .toEqual({ kind: 'after', categoryId: 'one', taskId: 'a', index: 1 });
    expect(diaryPlacementFromTimelineDrop('planner-end:morning', groups, owned))
      .toEqual({ kind: 'after', categoryId: 'two', taskId: 'c', index: 1 });
    expect(diaryPlacementFromTimelineDrop('timeline-diary-boundary:bottom', groups, owned))
      .toEqual({ kind: 'bottom' });
    expect(diaryPlacementFromTimelineDrop('timeline-diary-boundary:top', groups, owned))
      .toEqual({ kind: 'top' });
  });

  it('refuses non-task or empty-section drops rather than saving an unrelated placement', () => {
    expect(diaryPlacementFromTimelineDrop('planner-end:', groups, owned)).toBeNull();
    expect(diaryPlacementFromTimelineDrop('planner-before:missing', groups, owned)).toBeNull();
    expect(diaryPlacementFromTimelineDrop('bad:target', groups, owned)).toBeNull();
    expect(owned.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });
});
