import { getConnectivitySnapshot } from './connectivity';
import { ExecutionMethod } from 'appwrite';
import { MESSAGE_ACTION_FUNCTION_ID } from './messageDelivery';
import { guardedFunctions } from './sdk';
import type { TaskDocument, CategoryDocument } from '../db/schema';
import {
  getCachedCalendar,
  setCachedCalendar,
  type FriendCalendarBundle,
} from './friendCache';
const DEBUG = import.meta.env.DEV;
type AppwriteRow = Record<string, unknown>;
function mapTaskRow(row: AppwriteRow): TaskDocument {
  return {
    id: (row.$id as string) || '',
    title: (row.title as string) || '',
    completed: (row.is_completed as boolean) ?? false,
    categoryId: (row.category_id as string) || '',
    order: typeof row.order === 'number' ? row.order : 0,
    tags: (row.tags as string) || '',
    date: (row.date as string) || '',
    memo: (row.memo as string) || '',
    image: (row.image as string) || '',
    createdAt: (row.created_at as string) || '',
    completedAt: (row.completed_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
    source: (row.source as string) || '',
    userId: (row.user_id as string) || '',
    isDeleted: (row.deleted as boolean) ?? false,
    routineId: (row.routine_id as string) || '',
    reminderTime: (row.reminder_time as string) || '',
    reactions: (row.reactions as string) || '',
    visibility:
      (row.visibility as 'public' | 'followers' | 'private') || 'private',
  };
}
function mapCategoryRow(row: AppwriteRow): CategoryDocument {
  return {
    id: (row.$id as string) || '',
    name: (row.name as string) || '',
    color: (row.color as string) || '#6B7280',
    order: (row.order as number) ?? 0,
    visibility:
      (row.visibility as 'public' | 'followers' | 'private') || 'private',
    userId: (row.user_id as string) || '',
    isDeleted: (row.deleted as boolean) ?? false,
    icon: (row.icon as string) || '',
    // `updated_at` was added to the friend's categories table by the D6
    // migration. If the friend has not yet run the migration script, the
    // column is absent from the response and we fall back to '' — same
    // convention as `fromAppwriteFormat`.
    updatedAt: (row.updated_at as string) || '',
  };
}
export type FriendAccessErrorKind = 'forbidden' | 'offline' | 'server';
export class FriendAccessError extends Error {
  kind: FriendAccessErrorKind;
  constructor(message: string, kind: FriendAccessErrorKind) {
    super(message);
    this.name = 'FriendAccessError';
    this.kind = kind;
  }
}
export interface FetchFriendOptions {
  forceRefresh?: boolean;
}
export async function fetchFriendCalendar(
  ownerUserId: string,
  friendUserId: string,
  options: FetchFriendOptions = {}
): Promise<FriendCalendarBundle> {
  const offline = getConnectivitySnapshot().status !== 'online';
  if (!options.forceRefresh) {
    const cached = await getCachedCalendar(ownerUserId, friendUserId, {
      allowStale: offline,
    });
    if (cached) {
      if (DEBUG) console.log('[friendData] cache hit for', friendUserId);
      return cached;
    }
  }
  if (offline) {
    throw new FriendAccessError(
      "You need to be online to view a friend's calendar.",
      'offline'
    );
  }
  if (MESSAGE_ACTION_FUNCTION_ID.startsWith('REPLACE_')) {
    console.error(
      '[friendData] MESSAGE_ACTION_FUNCTION_ID not configured'
    );
    throw new FriendAccessError(
      'Configuration error. Please try again later.',
      'server'
    );
  }
  const execution = await guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify({
      action: 'get_friend_calendar',
      friendUserId,
    }),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed') {
    throw new FriendAccessError(
      'The request did not complete.',
      'server'
    );
  }
  const statusCode = execution.responseStatusCode;
  let parsed: {
    tasks?: AppwriteRow[];
    categories?: AppwriteRow[];
    fetchedAt?: string;
    error?: string;
  };
  try {
    parsed = JSON.parse(execution.responseBody);
  } catch (err) {
    console.error('[friendData] Response parse failed:', err);
    throw new FriendAccessError('Unexpected server response.', 'server');
  }
  if (statusCode === 403) {
    throw new FriendAccessError(
      'You are not friends with this user.',
      'forbidden'
    );
  }
  if (statusCode >= 400) {
    console.error('[friendData] Function returned error:', parsed.error);
    throw new FriendAccessError(
      parsed.error || 'Could not load the calendar.',
      'server'
    );
  }
  const bundle: FriendCalendarBundle = {
    friendUserId,
    tasks: (parsed.tasks || []).map(mapTaskRow),
    categories: (parsed.categories || []).map(mapCategoryRow),
    fetchedAt: parsed.fetchedAt || new Date().toISOString(),
  };
  await setCachedCalendar(ownerUserId, bundle);
  if (DEBUG) {
    console.log(
      `[friendData] fetched for ${friendUserId}:`,
      bundle.tasks.length,
      'tasks,',
      bundle.categories.length,
      'categories'
    );
  }
  return bundle;
}

/**
 * Minimal, live-authorized lookup for Alerts -> Friend Day View.
 * Returns null only when the previously deployed Function lacks the action;
 * a 403/404 is authoritative and must not fall back to cached private data.
 */
export async function fetchFriendAlertTask(
  ownerUserId: string,
  friendUserId: string,
  taskId: string,
  completedAt: string
): Promise<{ task: TaskDocument; category: CategoryDocument | null } | null> {
  if (!ownerUserId || !friendUserId || !taskId || !completedAt) {
    throw new FriendAccessError('Invalid friend task request.', 'server');
  }
  if (getConnectivitySnapshot().status !== 'online') {
    throw new FriendAccessError('The friend task cannot be checked offline.', 'offline');
  }
  const execution = await guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify({
      action: 'get_friend_task',
      friendUserId, taskId, completedAt,
    }),
    async: false,
    xpath: '/',
    method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed') {
    throw new FriendAccessError('The request did not complete.', 'server');
  }
  let parsed: {
    task?: AppwriteRow;
    category?: AppwriteRow | null;
    error?: string;
  };
  try {
    parsed = JSON.parse(execution.responseBody);
  } catch {
    throw new FriendAccessError('Unexpected server response.', 'server');
  }
  if (execution.responseStatusCode === 400 &&
      parsed.error === 'Unknown action: get_friend_task') {
    return null; // Deployment-safe compatibility until the new Function activates.
  }
  if (execution.responseStatusCode === 403 || execution.responseStatusCode === 404) {
    throw new FriendAccessError('This task is no longer available to view.', 'forbidden');
  }
  if (execution.responseStatusCode >= 400 || !parsed.task ||
      parsed.task.$id !== taskId || parsed.task.user_id !== friendUserId) {
    throw new FriendAccessError('Could not load the friend task.', 'server');
  }
  return {
    task: mapTaskRow(parsed.task),
    category: parsed.category ? mapCategoryRow(parsed.category) : null,
  };
}
