import type { ActivityDocument, ActivityTaskLinkDocument, CategoryDocument, TaskDocument } from '../db/schema';
import type { TaskOrderGroup } from './taskOrder';

/** Pure Day View adapters. Never create real tasks or include activities in task sync. */
const PREFIX = '__workout__';
export const workoutRowId = (id: string) => PREFIX + id;
export const isWorkoutRowId = (id: string) => id.startsWith(PREFIX);
export const activityIdFromWorkoutRow = (id: string) => isWorkoutRowId(id) ? id.slice(PREFIX.length) : null;

const SPORT_TOKENS: Record<string, readonly string[]> = {
  run: ['run', 'running', 'jog', 'jogging'],
  walk: ['walk', 'walking', 'hike', 'hiking'],
  ride: ['bike', 'biking', 'cycling', 'cycle'],
  swim: ['swim', 'swimming'],
  lift: ['lift', 'lifting', 'weights', 'strength'],
};
const GENERAL = ['workout', 'workouts', 'fitness', 'exercise', 'gym', 'training', 'train', 'sport', 'sports', 'activity', 'activities', 'lift', 'lifting', 'strength', 'run', 'running', 'cardio'];
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function suggestWorkoutCategory(
  categories: readonly CategoryDocument[],
  sport: string,
  rememberedId?: string,
): CategoryDocument | null {
  const active = categories.filter(category => !category.isDeleted);
  const remembered = active.find(category => category.id === rememberedId);
  if (remembered) return remembered;
  const sportLabel = normalize(sport);
  const sportKeywords = Object.entries(SPORT_TOKENS)
    .filter(([name, words]) => sportLabel.includes(name) || words.some(word => sportLabel.split(' ').includes(word)))
    .flatMap(([, words]) => words);
  let best: CategoryDocument | null = null;
  let highest = 0;
  for (const category of active) {
    const name = normalize(category.name);
    const words = name.split(' ');
    const specific = sportKeywords.some(word => words.includes(word));
    const general = GENERAL.some(word => words.includes(word));
    const exactSpecific = sportKeywords.includes(name);
    const exactGeneral = GENERAL.includes(name);
    const score = exactSpecific ? 110 : exactGeneral ? 100 : specific ? 55 : general ? 45 : 0;
    if (score > highest) { highest = score; best = category; }
  }
  return best;
}

export interface WorkoutPresentation {
  proxies: TaskDocument[];
  standalone: Map<string, ActivityDocument>;
  linkedByTask: Map<string, ActivityDocument[]>;
  unassigned: ActivityDocument[];
}

/** A same-owner, same-day attached workout is displayed only beneath its real task. */
export function buildWorkoutPresentation(
  activities: readonly ActivityDocument[],
  links: readonly ActivityTaskLinkDocument[],
  tasks: readonly TaskDocument[],
  categories: readonly CategoryDocument[],
  ownerId: string,
  dateStr: string,
): WorkoutPresentation {
  const ownedTasks = new Map(tasks
    .filter(t => t.userId === ownerId && t.date === dateStr && !t.isDeleted)
    .map(t => [t.id, t]));
  const ownedCategories = new Set(categories.filter(c => c.userId === ownerId && !c.isDeleted).map(c => c.id));
  const byActivity = new Map<string, string>();
  for (const link of links) {
    if (link.userId !== ownerId || link.isDeleted || byActivity.has(link.activityId) ||
        !ownedTasks.has(link.taskId)) continue;
    byActivity.set(link.activityId, link.taskId);
  }

  const proxies: TaskDocument[] = [];
  const standalone = new Map<string, ActivityDocument>();
  const linkedByTask = new Map<string, ActivityDocument[]>();
  const unassigned: ActivityDocument[] = [];
  for (const activity of activities) {
    if (activity.userId !== ownerId || activity.localDate !== dateStr || activity.isDeleted ||
        activity.source === 'ifttt_strava_csv') continue;
    const taskId = byActivity.get(activity.id);
    if (taskId) {
      const list = linkedByTask.get(taskId) ?? [];
      list.push(activity);
      linkedByTask.set(taskId, list);
      continue;
    }
    if (!activity.categoryId || !ownedCategories.has(activity.categoryId)) {
      unassigned.push(activity);
      continue;
    }
    const id = workoutRowId(activity.id);
    standalone.set(id, activity);
    proxies.push({
      id, title: activity.title, completed: true,
      categoryId: activity.categoryId,
      order: Number.isFinite(activity.order) ? activity.order! : 1_000_000,
      date: activity.localDate, createdAt: activity.createdAt,
      completedAt: activity.completedAt, updatedAt: activity.updatedAt,
      userId: ownerId, isDeleted: false, visibility: 'private',
    });
  }
  return { proxies, standalone, linkedByTask, unassigned };
}

export interface WorkoutOrderAssignment {
  activityId: string;
  categoryId: string;
  order: number;
}

/** Interleave workout-only positions between canonical task ranks. A task reorder
 * still writes ONLY task IDs to task persistence; workout order remains local.
 */
export function buildWorkoutOrderAssignments(
  groups: readonly TaskOrderGroup[],
  realTaskIds: ReadonlySet<string>,
  workoutIds: ReadonlySet<string>,
): WorkoutOrderAssignment[] {
  const result: WorkoutOrderAssignment[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    let taskIndex = -1;
    let segment: string[] = [];
    const flush = () => {
      segment.forEach((id, index) => {
        if (seen.has(id)) throw new Error('Duplicate workout in reorder');
        seen.add(id);
        result.push({
          activityId: activityIdFromWorkoutRow(id)!,
          categoryId: group.categoryId,
          order: taskIndex + (index + 1) / (segment.length + 1),
        });
      });
      segment = [];
    };
    for (const id of group.taskIds) {
      if (realTaskIds.has(id)) { flush(); taskIndex += 1; continue; }
      if (!workoutIds.has(id) || !isWorkoutRowId(id)) {
        throw new Error('Unexpected row in workout reorder');
      }
      segment.push(id);
    }
    flush();
  }
  return result;
}

/** Diary slots are indexed by real tasks, not virtual workout rows. */
export function mixedDiarySlotIndex(rows: readonly TaskDocument[], taskSlot: number): number {
  let realSeen = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (!isWorkoutRowId(rows[i].id)) {
      if (realSeen === taskSlot) return i;
      realSeen += 1;
    }
  }
  return rows.length;
}
