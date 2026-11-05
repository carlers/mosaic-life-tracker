import { describe, expect, it } from 'vitest';
import type { TaskDocument } from '../db/schema';
import {
  buildTimelineGroups, displayedTimelineSection, parseTimelinePlacement,
  planTimelineMove, resolveTimelineGranularity, timelinePlacementKey,
} from './timelinePlanner';

const task = (id: string, date = '2026-11-05'): TaskDocument => ({
  id, userId: 'owner', date, categoryId: id === 'b' ? 'work' : 'personal',
  order: 0, createdAt: '2026-11-05T09:00:00.000Z', updatedAt: '', title: id,
  completed: false, isDeleted: false, visibility: 'private',
});

describe('private manual timeline planner', () => {
  const tasks = [task('a'), task('b'), task('c')];
  const placement = (entries: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(entries).map(([k, v]) => [timelinePlacementKey(k), v]));

  it('has safe section and rank fallback for old or malformed settings', () => {
    expect(resolveTimelineGranularity('wrong')).toBe('three');
    expect(parseTimelinePlacement({ section: 'invalid', rank: Infinity })).toEqual({ section: '', rank: null });
    expect(buildTimelineGroups(tasks, {}, 'three').at(-1)?.tasks.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves fine assignments in three, six and off projections', () => {
    const settings = placement({
      a: { section: 'early-morning', rank: 3 },
      b: { section: 'late-morning', rank: 4 },
      c: { section: 'night', rank: 5 },
    });
    expect(buildTimelineGroups(tasks, settings, 'three')[0].tasks.map(t => t.id)).toEqual(['a', 'b']);
    expect(buildTimelineGroups(tasks, settings, 'six')[1].tasks.map(t => t.id)).toEqual(['b']);
    expect(buildTimelineGroups(tasks, settings, 'off')[0].tasks.map(t => t.id)).toEqual(['a', 'b', 'c']);
    expect(displayedTimelineSection('morning', 'six')).toBe('early-morning');
    expect(settings[timelinePlacementKey('b')]).toEqual({ section: 'late-morning', rank: 4 });
  });

  it('moves only one placement between ranked neighbors, not category order', () => {
    const settings = placement({
      a: { section: 'morning', rank: 100 },
      b: { section: 'morning', rank: 200 },
      c: { section: 'morning', rank: 300 },
    });
    const before = tasks.map(t => [t.id, t.categoryId, t.order]);
    expect(planTimelineMove(tasks, settings, 'three', 'c', 'morning', 'b'))
      .toEqual([{ taskId: 'c', section: 'morning', rank: 150 }]);
    expect(tasks.map(t => [t.id, t.categoryId, t.order])).toEqual(before);
  });

  it('retains a detailed section for within-parent reordering', () => {
    const settings = placement({
      a: { section: 'early-morning', rank: 100 },
      b: { section: 'late-morning', rank: 300 },
    });
    expect(planTimelineMove(tasks.slice(0,2), settings, 'three', 'b', 'morning', 'a'))
      .toEqual([{ taskId: 'b', section: 'late-morning', rank: -924 }]);
  });

  it('changes a section when dragged across periods and preserves it in Off mode', () => {
    const settings = placement({ a: { section: 'morning', rank: 10 } });
    expect(planTimelineMove(tasks.slice(0,1), settings, 'three', 'a', 'night'))
      .toEqual([{ taskId: 'a', section: 'night', rank: 1024 }]);
    expect(planTimelineMove(tasks.slice(0,1), settings, 'off', 'a', 'all'))
      .toEqual([{ taskId: 'a', section: 'morning', rank: 1024 }]);
  });

  it('rebalances dense destination ranks deterministically', () => {
    const settings = placement({
      a: { section: 'night', rank: 1 },
      b: { section: 'night', rank: 1.001 },
      c: { section: 'night', rank: 2 },
    });
    const moved = planTimelineMove(tasks, settings, 'three', 'c', 'night', 'b');
    expect(moved.map(item => item.taskId)).toEqual(['a', 'c', 'b']);
    expect(moved.map(item => item.rank)).toEqual([1024, 2048, 3072]);
  });

  it('rejects stale/missing drop targets without writes', () => {
    expect(planTimelineMove(tasks, {}, 'six', 'a', 'morning')).toEqual([]);
    expect(planTimelineMove(tasks, {}, 'three', 'missing', 'night')).toEqual([]);
    expect(planTimelineMove(tasks, {}, 'three', 'a', 'night', 'missing')).toEqual([]);
  });  it('resets a rank on rescheduling without erasing its saved time section', () => {
    const settings = placement({
      a: { section: 'night', rank: -1000, date: '2026-11-04' },
      b: { section: 'night', rank: 10, date: '2026-11-05' },
    });
    const values = buildTimelineGroups(tasks.slice(0, 2), settings, 'three');
    expect(values.find(group => group.id === 'night')?.tasks.map(value => value.id)).toEqual(['b', 'a']);
    expect(parseTimelinePlacement(settings[timelinePlacementKey('a')]).section).toBe('night');
  });
});
