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
  friendUserId: string,
  options: FetchFriendOptions = {}
): Promise<FriendCalendarBundle> {
  if (!options.forceRefresh) {
    const cached = await getCachedCalendar(friendUserId);
    if (cached) {
      if (DEBUG) console.log('[friendData] cache hit for', friendUserId);
      return cached;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
  await setCachedCalendar(bundle);
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
