import type { TaskDocument } from '../db/schema';

export type TimelineGranularity = 'off' | 'two' | 'three' | 'six';
export type TimelineSection =
  | '' | 'day' | 'morning' | 'afternoon' | 'night'
  | 'early-morning' | 'late-morning'
  | 'early-afternoon' | 'late-afternoon'
  | 'early-night' | 'late-night';
export type TimelineGroupId = TimelineSection | 'all';
export interface TimelinePlacement {
  section: TimelineSection;
  rank: number | null;
  date?: string;
}
export interface TimelineGroup {
  id: TimelineGroupId;
  label: string;
  tasks: TaskDocument[];
}
export interface TimelineMove {
  taskId: string;
  section: TimelineSection;
  rank: number;
}

/** Each private, owner-scoped settings row stores one task's planner metadata. */
export const TIMELINE_GRANULARITY_SETTING_KEY = 'dayTimelineGranularity';
export const TIMELINE_NEW_TASK_POSITION_SETTING_KEY = 'dayTimelineNewTaskPosition';
export type TimelineNewTaskPosition = 'top' | 'bottom';
export function resolveTimelineNewTaskPosition(value: unknown): TimelineNewTaskPosition {
  return value === 'top' ? 'top' : 'bottom';
}
export const TIMELINE_PLACEMENT_PREFIX = 'dayTimelineTask.';
export const timelinePlacementKey = (taskId: string) =>
  TIMELINE_PLACEMENT_PREFIX + taskId;

export function resolveTimelineGranularity(value: unknown): TimelineGranularity {
  return value === 'off' || value === 'two' || value === 'six' ? value : 'three';
}
const sections: Record<Exclude<TimelineGranularity, 'off'>, readonly TimelineGroupId[]> = {
  two: ['day', 'night', ''],
  three: ['morning', 'afternoon', 'night', ''],
  six: ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'early-night', 'late-night', ''],
};
export const timelineSectionOptions = (granularity: TimelineGranularity): TimelineGroupId[] =>
  granularity === 'off' ? ['all'] : [...sections[granularity]];

const title: Record<TimelineGroupId, string> = {
  all: 'All tasks',
  '': 'Unassigned',
  day: 'Day',
  morning: 'Morning', afternoon: 'Afternoon', night: 'Night',
  'early-morning': 'Early Morning', 'late-morning': 'Late Morning',
  'early-afternoon': 'Early Afternoon', 'late-afternoon': 'Late Afternoon',
  'early-night': 'Early Night', 'late-night': 'Late Night',
};
export const timelineSectionLabel = (section: TimelineGroupId): string => title[section];

const sectionValues = new Set<TimelineSection>([
  '', 'day', 'morning', 'afternoon', 'night',
  'early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'early-night', 'late-night',
]);
export function resolveTimelineSection(value: unknown): TimelineSection {
  return typeof value === 'string' && sectionValues.has(value as TimelineSection)
    ? value as TimelineSection : '';
}
export function parseTimelinePlacement(value: unknown): TimelinePlacement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { section: '', rank: null };
  }
  const raw = value as Record<string, unknown>;
  return {
    section: resolveTimelineSection(raw.section),
    ...(typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? { date: raw.date } : {}),
    rank: typeof raw.rank === 'number' && Number.isFinite(raw.rank)
      && Math.abs(raw.rank) < Number.MAX_SAFE_INTEGER / 2 ? raw.rank : null,
  };
}
export function displayedTimelineSection(
  stored: TimelineSection, granularity: TimelineGranularity
): TimelineGroupId {
  if (granularity === 'off') return 'all';
  if (granularity === 'two') {
    if (stored === 'day' || stored.includes('morning') || stored.includes('afternoon')) return 'day';
    if (stored.includes('night')) return 'night';
    return '';
  }
  if (granularity === 'three') {
    // Broad Day is retained in storage. Afternoon is only a display fallback
    // when showing finer sections; it does not rewrite the saved assignment.
    if (stored === 'day') return 'afternoon';
    if (stored.includes('morning')) return 'morning';
    if (stored.includes('afternoon')) return 'afternoon';
    if (stored.includes('night')) return 'night';
    return '';
  }
  if (stored === 'day') return 'early-afternoon';
  if (stored === 'morning') return 'early-morning';
  if (stored === 'afternoon') return 'early-afternoon';
  if (stored === 'night') return 'early-night';
  return stored;
}
export function timelineRank(task: TaskDocument, placement: TimelinePlacement): number {
  if (placement.rank !== null && (!placement.date || placement.date === task.date)) return placement.rank;
  const created = Date.parse(task.createdAt ?? '');
  return Number.isFinite(created) ? created : 0;
}
export function buildTimelineGroups(
  tasks: readonly TaskDocument[], settings: Readonly<Record<string, unknown>>,
  granularity: TimelineGranularity
): TimelineGroup[] {
  const ids = timelineSectionOptions(granularity);
  const buckets = new Map<TimelineGroupId, TaskDocument[]>(ids.map(id => [id, []]));
  for (const task of tasks) {
    const placement = parseTimelinePlacement(settings[timelinePlacementKey(task.id)]);
    const id = displayedTimelineSection(placement.section, granularity);
    buckets.get(id)?.push(task);
  }
  for (const values of buckets.values()) {
    values.sort((a, b) => {
      const left = timelineRank(a, parseTimelinePlacement(settings[timelinePlacementKey(a.id)]));
      const right = timelineRank(b, parseTimelinePlacement(settings[timelinePlacementKey(b.id)]));
      return left - right || a.id.localeCompare(b.id);
    });
  }
  return ids.map(id => ({ id, label: timelineSectionLabel(id), tasks: buckets.get(id) ?? [] }));
}

/**
 * Convert a displayed drop into private per-task settings writes. In normal
 * cases only the dragged task changes. Dense ranks compact one target section.
 * A three-section move within a matching period retains the saved early/late
 * assignment so changing the display preference never discards it.
 */
export function planTimelineMove(
  tasks: readonly TaskDocument[],
  settings: Readonly<Record<string, unknown>>,
  granularity: TimelineGranularity,
  taskId: string,
  destination: TimelineGroupId,
  beforeTaskId?: string
): TimelineMove[] {
  if (!timelineSectionOptions(granularity).includes(destination)) return [];
  const task = tasks.find(t => t.id === taskId);
  if (!task) return [];
  const groups = buildTimelineGroups(tasks, settings, granularity);
  const target = groups.find(group => group.id === destination);
  if (!target) return [];
  const values = target.tasks.filter(t => t.id !== taskId);
  const at = beforeTaskId === undefined ? values.length : values.findIndex(t => t.id === beforeTaskId);
  if (at < 0) return [];
  values.splice(at, 0, task);
  const previous = at > 0 ? values[at - 1] : null;
  const next = at + 1 < values.length ? values[at + 1] : null;
  const previousRank = previous ? timelineRank(previous, parseTimelinePlacement(settings[timelinePlacementKey(previous.id)])) : null;
  const nextRank = next ? timelineRank(next, parseTimelinePlacement(settings[timelinePlacementKey(next.id)])) : null;
  const stored = parseTimelinePlacement(settings[timelinePlacementKey(taskId)]).section;
  const section = granularity === 'off' ? stored
    : displayedTimelineSection(stored, granularity) === destination ? stored : destination as TimelineSection;
  let rank: number;
  if (previousRank !== null && nextRank !== null) rank = (previousRank + nextRank) / 2;
  else if (previousRank !== null) rank = previousRank + 1024;
  else if (nextRank !== null) rank = nextRank - 1024;
  else rank = 1024;
  if (!Number.isFinite(rank) || Math.abs(rank) >= Number.MAX_SAFE_INTEGER / 2 ||
    (previousRank !== null && rank - previousRank < 0.5) ||
    (nextRank !== null && nextRank - rank < 0.5)) {
    return values.map((value, index) => ({
      taskId: value.id,
      section: value.id === taskId ? section :
        parseTimelinePlacement(settings[timelinePlacementKey(value.id)]).section,
      rank: (index + 1) * 1024,
    }));
  }
  const old = parseTimelinePlacement(settings[timelinePlacementKey(taskId)]);
  if (old.section === section && old.rank === rank) return [];
  return [{ taskId, section, rank }];
}


/**
 * A live drag projection is presentation-only. No categories, tasks, settings,
 * completion flags or persistence state are mutated until a valid release.
 * Invalid/self-targeted hovers return the original groups unchanged.
 */
export function projectTimelineGroups(
  groups: readonly TimelineGroup[],
  taskId: string,
  destination: TimelineGroupId,
  beforeTaskId?: string
): TimelineGroup[] {
  const from = groups.find(group => group.tasks.some(task => task.id === taskId));
  const to = groups.find(group => group.id === destination);
  if (!from || !to || beforeTaskId === taskId) return groups as TimelineGroup[];
  const projected = groups.map(group => ({ ...group, tasks: [...group.tasks] }));
  const sourceGroup = projected.find(group => group.id === from.id)!;
  const sourceIndex = sourceGroup.tasks.findIndex(task => task.id === taskId);
  const [dragged] = sourceGroup.tasks.splice(sourceIndex, 1);
  const targetGroup = projected.find(group => group.id === destination)!;
  const targetIndex = beforeTaskId === undefined
    ? targetGroup.tasks.length
    : targetGroup.tasks.findIndex(task => task.id === beforeTaskId);
  if (targetIndex < 0) return groups as TimelineGroup[];
  targetGroup.tasks.splice(targetIndex, 0, dragged);
  if (projected.every((group, i) => group.tasks.every((task, j) => task.id === groups[i].tasks[j]?.id)
    && group.tasks.length === groups[i].tasks.length)) return groups as TimelineGroup[];
  return projected;
}
