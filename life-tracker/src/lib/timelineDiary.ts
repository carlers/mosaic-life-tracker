import type { TaskDocument } from '../db/schema';
import {
  anchoredDiaryPlacement, diarySlotIndex, type DiaryPlacement,
} from './diaryPlacement';
import type { TimelineGroup } from './timelinePlanner';

export type TimelineDiarySlot =
  | { kind: 'top' | 'bottom' }
  | { kind: 'before' | 'after'; taskId: string };

const categoryOrder = (tasks: readonly TaskDocument[], categoryId: string): string[] =>
  tasks.filter(task => !task.isDeleted && task.categoryId === categoryId)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map(task => task.id);

/**
 * Project the existing Day View diary placement into Timeline's task order.
 * This is a display-only projection: per-day diaryPlacement remains the source
 * of truth in Categories and Timeline, with the same user top/bottom fallback.
 */
export function resolveTimelineDiarySlot(
  placement: DiaryPlacement,
  groups: readonly TimelineGroup[],
  tasks: readonly TaskDocument[],
  fallback: 'top' | 'bottom'
): TimelineDiarySlot {
  if (placement.kind === 'top' || placement.kind === 'bottom') return placement;
  const visibleIds = new Set(groups.flatMap(group => group.tasks.map(task => task.id)));
  if ((placement.kind === 'before' || placement.kind === 'after') &&
      visibleIds.has(placement.taskId)) {
    return { kind: placement.kind, taskId: placement.taskId };
  }
  // The top/bottom variant shares one discriminant union member, so retain
  // a structural guard before accessing the category anchor.
  if (!('categoryId' in placement)) return { kind: fallback };
  const categoryTasks = categoryOrder(tasks, placement.categoryId);
  if (categoryTasks.length) {
    const index = diarySlotIndex(placement, categoryTasks);
    const preceding = categoryTasks.slice(0, index).reverse().find(id => visibleIds.has(id));
    if (preceding) return { kind: 'after', taskId: preceding };
    const following = categoryTasks.slice(index).find(id => visibleIds.has(id));
    if (following) return { kind: 'before', taskId: following };
  }
  return { kind: fallback };
}

/**
 * Translate Timeline target positions into the existing anchored diary format.
 * Moving the diary near a task also updates its relative slot in Categories.
 * Empty time sections cannot be represented by category-owned anchors and
 * therefore return null rather than silently moving the diary elsewhere.
 */
export function diaryPlacementFromTimelineDrop(
  target: string,
  groups: readonly TimelineGroup[],
  tasks: readonly TaskDocument[]
): DiaryPlacement | null {
  if (target === 'timeline-diary-boundary:top') return { kind: 'top' };
  if (target === 'timeline-diary-boundary:bottom') return { kind: 'bottom' };
  let before = true;
  let taskId = '';
  if (target.startsWith('planner-before:')) {
    taskId = target.slice('planner-before:'.length);
  } else if (target.startsWith('planner-after:')) {
    before = false;
    taskId = target.slice('planner-after:'.length);
  } else if (target.startsWith('planner-end:')) {
    const sectionId = target.slice('planner-end:'.length);
    const section = groups.find(group => group.id === sectionId);
    if (!section?.tasks.length) return null;
    taskId = section.tasks[section.tasks.length - 1].id;
    before = false;
  } else {
    return null;
  }
  const matched = groups.flatMap(group => group.tasks).find(task => task.id === taskId);
  if (!matched) return null;
  const peers = categoryOrder(tasks, matched.categoryId);
  const index = peers.indexOf(taskId);
  if (index < 0) return null;
  return anchoredDiaryPlacement(matched.categoryId, index + (before ? 0 : 1), peers);
}
