import type { TaskDocument } from '../db/schema';
import { sendAppAction } from './appAction';

export interface NotificationItem {
  id: string;
  type: 'task_completed';
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorAvatarFileId: string;
  occurredAt: string;
  createdAt: string;
  readAt: string;
  categoryColor: string;
  task: TaskDocument;
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string;
  fetchedAt: string;
}

function isTask(value: unknown): value is TaskDocument {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<TaskDocument>;
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.date === 'string' &&
    typeof task.userId === 'string' &&
    typeof task.categoryId === 'string'
  );
}

function isNotificationItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<NotificationItem>;
  return (
    typeof item.id === 'string' &&
    item.type === 'task_completed' &&
    typeof item.actorId === 'string' &&
    typeof item.actorName === 'string' &&
    typeof item.occurredAt === 'string' &&
    typeof item.categoryColor === 'string' &&
    isTask(item.task)
  );
}

export async function fetchNotifications(
  cursor = '',
  limit = 30
): Promise<NotificationPage> {
  const result = await sendAppAction({
    action: 'get_notifications',
    cursor,
    limit,
  });
  const rawItems = Array.isArray(result.items) ? result.items : [];
  return {
    items: rawItems.filter(isNotificationItem).map((item) => ({
      ...item,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : item.occurredAt,
    })),
    nextCursor:
      typeof result.nextCursor === 'string' ? result.nextCursor : '',
    fetchedAt:
      typeof result.fetchedAt === 'string'
        ? result.fetchedAt
        : new Date().toISOString(),
  };
}

export async function markNotificationsRead(ids: string[]): Promise<string> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return '';
  const response = await sendAppAction({
    action: 'mark_notifications_read',
    ids: uniqueIds,
  });
  return typeof response.readAt === 'string' ? response.readAt : new Date().toISOString();
}
