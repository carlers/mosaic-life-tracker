import { format, isValid } from 'date-fns';
import type { TaskDocument } from '../db/schema';

export type TimestampLabelStyle = 'icons' | 'text';
export type TimelineDirection = 'asc' | 'desc';
export type DayViewMode = 'categories' | 'timeline';

export interface TaskTimestampDisplay {
  showCreated: boolean;
  showCompleted: boolean;
  labelStyle: TimestampLabelStyle;
}

export const resolveTimestampLabelStyle = (value: unknown): TimestampLabelStyle =>
  value === 'text' ? 'text' : 'icons';

export const resolveDayViewMode = (value: unknown): DayViewMode =>
  value === 'timeline' ? 'timeline' : 'categories';

export const resolveTimelineDirection = (value: unknown): TimelineDirection =>
  value === 'asc' ? 'asc' : 'desc';

export function validTaskTime(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function effectiveTaskTimestamp(task: TaskDocument): { kind: 'created' | 'completed'; value: string } | null {
  if (task.completed && validTaskTime(task.completedAt) !== null) {
    return { kind: 'completed', value: task.completedAt! };
  }
  if (validTaskTime(task.createdAt) !== null) {
    return { kind: 'created', value: task.createdAt };
  }
  return null;
}

export function sortTasksByTimeline(tasks: readonly TaskDocument[], direction: TimelineDirection): TaskDocument[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const left = effectiveTaskTimestamp(a);
    const right = effectiveTaskTimestamp(b);
    const lt = left ? validTaskTime(left.value)! : null;
    const rt = right ? validTaskTime(right.value)! : null;
    if (lt === null && rt !== null) return 1;
    if (rt === null && lt !== null) return -1;
    if (lt !== null && rt !== null && lt !== rt) return multiplier * (lt - rt);
    const ca = validTaskTime(a.createdAt);
    const cb = validTaskTime(b.createdAt);
    if (ca !== null && cb !== null && ca !== cb) return multiplier * (ca - cb);
    return a.id.localeCompare(b.id);
  });
}

/** Render in the browser's local timezone; show the date when unlike the scheduled day. */
export function formatTaskTimestamp(value: string | undefined, scheduledDate: string): string | null {
  if (validTaskTime(value) === null) return null;
  const date = new Date(value!);
  if (!isValid(date)) return null;
  const day = format(date, 'yyyy-MM-dd');
  return scheduledDate && day === scheduledDate
    ? format(date, 'h:mm a')
    : format(date, 'MMM d, yyyy · h:mm a');
}
