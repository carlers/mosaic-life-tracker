import { describe, expect, it } from 'vitest';
import { ownerShareLabels, sharedByDate } from '../../src/lib/sharedTaskPresentation';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';

const row = (taskId: string, inviteeId: string, status: SharedTaskItem['status'], date = '2026-10-10'): SharedTaskItem => ({
  id: taskId + inviteeId, taskId, inviteeId, ownerId: 'owner', status, date,
  grantEpoch: 'epoch', membershipRevision: 'rev', completionRevision: 'task-rev',
  completed: false, title: 'Test task',
});

describe('shared task presentation', () => {
  it('groups only accepted shares by calendar date without cloning owner tasks', () => {
    const rows = [row('a','friend-a','pending'), row('a','friend-b','accepted'),
      row('b','friend-c','accepted','2026-10-11')];
    const dates = sharedByDate(rows);
    expect([...dates.keys()]).toEqual(['2026-10-10','2026-10-11']);
    expect(dates.get('2026-10-10')).toEqual([rows[1]]);
    expect(dates.get('2026-10-11')).toEqual([rows[2]]);
  });

  it('identifies pending-only shares even when pending labels are hidden', () => {
    const labels = ownerShareLabels([row('a','friend-a','pending')], [], 'names', false);
    expect(labels.get('a')).toBe('Shared · 1 pending');
  });

  it('shows names or count, with optional pending status', () => {
    const rows = [row('a','a','accepted'),row('a','b','accepted'),row('a','c','accepted'),row('a','d','pending')];
    const friends = [{friendId:'a',friendDisplayName:'Maya'},
      {friendId:'b',friendDisplayName:'Jules'}, {friendId:'c',friendUsername:'Sam'}];
    expect(ownerShareLabels(rows, friends, 'names', false).get('a')).toBe('Shared · Maya, Jules +1');
    expect(ownerShareLabels(rows, friends, 'count', true).get('a')).toBe('Shared · 3 friends · 1 pending');
    expect(ownerShareLabels(rows, friends, 'count', false).get('a')).toBe('Shared · 3 friends');
  });

  it('has no label after all active membership entries are removed', () => {
    expect(ownerShareLabels([], [], 'names', false).size).toBe(0);
  });
});
