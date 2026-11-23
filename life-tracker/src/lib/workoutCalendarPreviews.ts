import type { ActivityDocument, ActivityTaskLinkDocument, TaskDocument } from '../db/schema';

/** Calendar-only Activity projection. Kept out of task persistence, friend reads
 * and task completion counts. A linked workout has one canonical task block.
 */
export function buildWorkoutCalendarPreviews(
  activities: readonly ActivityDocument[],
  links: readonly ActivityTaskLinkDocument[],
  ownerTasks: readonly TaskDocument[],
  ownerId: string,
  categoryIds: readonly string[],
  categoryColors: Readonly<Record<string, { color: string; name: string }>>,
  query: string,
): ReadonlyMap<string, readonly ActivityDocument[]> {
  const output = new Map<string, ActivityDocument[]>();
  if (!ownerId) return output;
  const categoryFilter = categoryIds.length ? new Set(categoryIds) : null;
  const search = query.trim().toLocaleLowerCase();
  const tasks = new Map(ownerTasks.filter(task =>
    task.userId === ownerId && !task.isDeleted).map(task => [task.id, task]));
  const linked = new Set<string>();
  for (const link of links) {
    if (link.userId !== ownerId || link.isDeleted) continue;
    const task = tasks.get(link.taskId);
    if (task) linked.add(link.activityId);
  }
  for (const row of activities) {
    if (row.userId !== ownerId || row.isDeleted || row.source === 'ifttt_strava_csv' ||
      !row.categoryId || !categoryColors[row.categoryId] || linked.has(row.id) ||
      (categoryFilter && !categoryFilter.has(row.categoryId)) ||
      (search && !row.title.toLocaleLowerCase().includes(search)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.localDate)) continue;
    const list = output.get(row.localDate);
    if (list) list.push(row);
    else output.set(row.localDate, [row]);
  }
  for (const group of output.values()) group.sort((a,b) =>
    (a.order ?? 1_000_000) - (b.order ?? 1_000_000) ||
    a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
  return output;
}
