import { Query } from 'appwrite';
import { guardedTablesDB } from '../lib/sdk';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
} from '../lib/appwriteConfig';

const PAGE_SIZE = 100;
const MAX_PAGES = 1000;

export async function loadAcceptedFriendIds(
  userId: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await guardedTablesDB.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLES.friendships,
      queries: [
        Query.equal('user_id', userId),
        Query.limit(PAGE_SIZE),
        Query.orderAsc('$id'),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    const rows =
      (response as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];

    for (const row of rows) {
      if (
        row.user_id === userId &&
        row.status === 'accepted' &&
        row.deleted !== true &&
        typeof row.friend_id === 'string' &&
        row.friend_id
      ) {
        ids.add(row.friend_id);
      }
    }

    if (rows.length < PAGE_SIZE) return ids;
    const next = rows.at(-1)?.$id;
    if (typeof next !== 'string' || !next || next === cursor) {
      throw new Error('Friend reference pagination stalled');
    }
    cursor = next;
  }

  throw new Error('Friend reference pagination exceeded safety limit');
}

export function sanitizeFriendCarouselValue(
  raw: string,
  acceptedFriendIds: Set<string>
): string {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as {
      order?: unknown;
      hidden?: unknown;
      [key: string]: unknown;
    };
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return JSON.stringify({ order: [], hidden: [] });
    }

    const next = { ...parsed };
    for (const key of ['order', 'hidden'] as const) {
      const value = parsed[key];
      if (value === undefined) continue;
      if (
        !Array.isArray(value) ||
        value.some((id) => typeof id !== 'string')
      ) {
        return JSON.stringify({ order: [], hidden: [] });
      }
      next[key] = value.filter((id) => acceptedFriendIds.has(id));
    }
    return JSON.stringify(next);
  } catch {
    return JSON.stringify({ order: [], hidden: [] });
  }
}

export function sanitizeTaskReactions(
  raw: string,
  acceptedFriendIds: Set<string>
): string {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return '';

    const next: Array<{ emoji: string; userIds: string[] }> = [];
    for (const reaction of parsed) {
      if (
        !reaction ||
        typeof reaction !== 'object' ||
        typeof (reaction as { emoji?: unknown }).emoji !== 'string' ||
        !Array.isArray((reaction as { userIds?: unknown }).userIds)
      ) {
        return '';
      }
      const userIds = (reaction as { userIds: unknown[] }).userIds;
      if (userIds.some((id) => typeof id !== 'string')) return '';
      const kept = (userIds as string[]).filter((id) =>
        acceptedFriendIds.has(id)
      );
      if (kept.length > 0) {
        next.push({
          emoji: (reaction as { emoji: string }).emoji,
          userIds: Array.from(new Set(kept)),
        });
      }
    }
    return next.length > 0 ? JSON.stringify(next) : '';
  } catch {
    return '';
  }
}
