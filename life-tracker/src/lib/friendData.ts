import { getConnectivitySnapshot } from './connectivity';
import { ExecutionMethod } from 'appwrite';
import { MESSAGE_ACTION_FUNCTION_ID } from './messageDelivery';
import { guardedFunctions } from './sdk';
import type { TaskDocument, CategoryDocument, DiaryDocument } from '../db/schema';
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
    retiredOn: (row.retired_on as string) || '',
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

/** Only authenticated, mutually accepted friends can request a bounded month. */
export type FriendDiaryDocument = DiaryDocument & { reactions?: string; quoteEpoch?: number };

export async function fetchFriendDiaryMonth(
  currentUserId: string, friendUserId: string, month: string
): Promise<FriendDiaryDocument[]> {
  if (!currentUserId || !friendUserId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new FriendAccessError('Invalid friend diary request.', 'server');
  }
  if (getConnectivitySnapshot().status !== 'online') {
    throw new FriendAccessError('Friend diaries require a connection.', 'offline');
  }
  const execution = await guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify({ action: 'get_friend_diary_month', friendUserId, month }),
    async: false, xpath: '/', method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed') {
    throw new FriendAccessError('Could not load friend diary.', 'server');
  }
  let parsed: { entries?: Record<string, unknown>[]; error?: string };
  try { parsed = JSON.parse(execution.responseBody); }
  catch { throw new FriendAccessError('Invalid friend diary response.', 'server'); }
  if (execution.responseStatusCode === 403 || execution.responseStatusCode === 404) {
    throw new FriendAccessError('Friend diary is unavailable.', 'forbidden');
  }
  if (execution.responseStatusCode >= 400 || !Array.isArray(parsed.entries)) {
    throw new FriendAccessError('Could not load friend diary.', 'server');
  }
  return parsed.entries.flatMap((row): FriendDiaryDocument[] => {
    if (row.user_id !== friendUserId || typeof row.date !== 'string' ||
      !row.date.startsWith(month + '-') || row.deleted === true ||
      !['public', 'followers'].includes(String(row.visibility))) return [];
    return [{
      id: String(row.$id || ''), userId: friendUserId, date: row.date,
      content: String(row.content || ''), emoji: String(row.emoji || ''),
      photos: String(row.photos || '[]'), reactions: String(row.reactions || ''),
      visibility: row.visibility as DiaryDocument['visibility'],
      quoteEpoch: typeof row.quote_epoch === 'number' ? row.quote_epoch : 0,
      createdAt: String(row.created_at || row.$createdAt || ''),
      updatedAt: String(row.updated_at || row.$updatedAt || ''),
      isDeleted: false,
    }];
  });
}

/** Server-gated reaction, never write a friend's diary row from the browser. */
export async function reactToFriendDiary(
  friendUserId: string, diaryId: string, emoji: string, op: 'add' | 'remove'
): Promise<void> {
  const execution = await guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify({ action: 'react_to_diary', friendUserId, diaryId, emoji, op }),
    async: false, xpath: '/', method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200)
    throw new FriendAccessError('Diary reaction could not be saved.', 'server');
}


/** Server-owned reaction ledger. No reactions are stored in owner diary CAS rows. */
export async function fetchOwnerDiaryReactions(diaryId: string): Promise<string> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/.test(diaryId)) {
    throw new FriendAccessError('Invalid diary entry.', 'server');
  }
  if (getConnectivitySnapshot().status !== 'online') {
    throw new FriendAccessError('Reactions require a connection.', 'offline');
  }
  const execution = await guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify({ action: 'get_owner_diary_reactions', diaryId }),
    async: false, xpath: '/', method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200) {
    throw new FriendAccessError('Reactions are unavailable.', 'server');
  }
  const result: unknown = JSON.parse(execution.responseBody);
  if (!result || typeof result !== 'object' ||
    typeof (result as { reactions?: unknown }).reactions !== 'string') {
    throw new FriendAccessError('Invalid reactions response.', 'server');
  }
  return (result as { reactions: string }).reactions;
}

/** A single private photo, returned only after fresh server-side diary ACL checks. */
export async function fetchFriendDiaryPhoto(friendUserId: string, diaryId: string, fileId: string): Promise<Blob> {
  const execution = await guardedFunctions.createExecution({
    functionId: MESSAGE_ACTION_FUNCTION_ID,
    body: JSON.stringify({ action: 'get_friend_diary_photo', friendUserId, diaryId, fileId }),
    async: false, xpath: '/', method: ExecutionMethod.POST,
  });
  if (execution.status !== 'completed' || execution.responseStatusCode !== 200)
    throw new FriendAccessError('Diary photo unavailable.', 'forbidden');
  const result = JSON.parse(execution.responseBody) as { mimeType?: string; data?: string };
  if (result.mimeType !== 'image/webp' || typeof result.data !== 'string' || result.data.length > 400000)
    throw new FriendAccessError('Diary photo unavailable.', 'server');
  const bytes = Uint8Array.from(atob(result.data), char => char.charCodeAt(0));
  return new Blob([bytes], { type: 'image/webp' });
}
