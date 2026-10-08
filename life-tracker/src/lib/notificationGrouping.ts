import { format } from 'date-fns';
import type { NotificationItem } from './notifications';

export interface ActivityGroup {
  key: string;
  actorId: string;
  actorName: string;
  actorAvatarFileId: string;
  occurredAt: string;
  earliestAt: string;
  items: NotificationItem[];
}

function completedTime(item: NotificationItem): number {
  const time = Date.parse(item.task.completedAt || item.occurredAt);
  return Number.isFinite(time) ? time : Date.parse(item.occurredAt);
}

/** Fixed local half-hour bins avoid unstable groups at pagination boundaries. */
export function groupNotificationActivity(items: NotificationItem[]): ActivityGroup[] {
  const result = new Map<string, ActivityGroup>();
  const ordered = [...items].sort(
    (a, b) => completedTime(b) - completedTime(a) || b.id.localeCompare(a.id)
  );
  for (const item of ordered) {
    const time = completedTime(item);
    if (!Number.isFinite(time)) continue;
    const date = new Date(time);
    const day = format(date, 'yyyy-MM-dd');
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    const bin = Math.floor(minuteOfDay / 30);
    const key = `${item.actorId}::${day}::${bin}`;
    const existing = result.get(key);
    if (existing) {
      existing.items.push(item);
      if (item.occurredAt > existing.occurredAt) existing.occurredAt = item.occurredAt;
      if (item.occurredAt < existing.earliestAt) existing.earliestAt = item.occurredAt;
    } else {
      result.set(key, {
        key,
        actorId: item.actorId,
        actorName: item.actorName,
        actorAvatarFileId: item.actorAvatarFileId,
        occurredAt: item.occurredAt,
        earliestAt: item.occurredAt,
        items: [item],
      });
    }
  }
  return [...result.values()].sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
}
