import { Permission, Role, Query } from 'appwrite';
import { getDatabase } from '../db/database';
import { isUnauthorizedError, OfflineError } from './authEvents';
import { guardedTablesDB } from './sdk';
import {
  emitSocialOutboxFailure,
  enqueueSocialOp,
  setSocialOutboxSender,
  type SocialOutboxAction,
  type SocialOutboxRemoteOp,
  type SocialOutboxRevertInfo,
} from './socialOutbox';
import type { FriendshipDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;
const APPWRITE_CONFIG = {
  databaseId: 'life_tracker',
  tables: {
    profiles: 'profiles',
    friendships: 'friendships',
  },
} as const;

export type FriendStatus =
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'accepted'
  | 'blocked';

export interface ProfileCard {
  $id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_file_id: string;
  bio: string;
  is_searchable: boolean;
}

export interface MyProfileInput {
  userId: string;
  username: string;
  displayName: string;
  avatarFileId?: string;
  bio?: string;
}

// The outbox's sender routes each queued op through the guarded SDK surface.
// Set at module init so `flushSocialOutbox` (called by AppLayout) is wired
// as soon as any consumer of `social.ts` loads. Mirrors the pattern in
// `messageDelivery.ts` for `setMessageActionSender`.
setSocialOutboxSender(async (op) => {
  if (op.kind === 'upsertRow') {
    await guardedTablesDB.upsertRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
      permissions: op.permissions,
    });
  } else {
    await guardedTablesDB.updateRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
    });
  }
});

async function makeFriendshipId(
  ownerId: string,
  friendId: string
): Promise<string> {
  const input = `${ownerId}|${friendId}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `fr_${hex.slice(0, 32)}`;
}

function buildProfileRowPermissions(userId: string) {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function buildCreatorOwnPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function toMs(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * A failure is "transient" when retrying it could eventually succeed:
 * network drop / offline (no numeric code), a timeout (no numeric code),
 * 429 (rate limit), or 5xx. 401 and any other 4xx are permanent.
 */
function isTransientSocialFailure(err: unknown): boolean {
  if (isUnauthorizedError(err)) return false;
  const code = (err as { code?: number } | null)?.code;
  if (typeof code !== 'number') return true;
  if (code === 429) return true;
  if (code >= 500) return true;
  return false;
}

/**
 * Routing for a failed direct remote write.
 *
 * - 401: the global auth redirect is already in flight; re-throw so the
 *   caller can stop work. Do not queue — the session is gone.
 * - Transient: enqueue into the persistent outbox; the next
 *   `AppLayout` `tryDeliver` (mount / focus / online) will retry.
 * - Permanent (non-429 4xx): emit the failure immediately so the local
 *   RxDB row can be reverted and the user is told. Do not queue.
 */
function handleSocialRemoteFailure(input: {
  err: unknown;
  userId: string;
  action: SocialOutboxAction;
  op: SocialOutboxRemoteOp;
  revert: SocialOutboxRevertInfo;
  dedupKey: string;
}): void {
  const { err, userId, action, op, revert, dedupKey } = input;
  if (isUnauthorizedError(err)) {
    throw err;
  }
  if (isTransientSocialFailure(err)) {
    enqueueSocialOp(userId, { action, op, revert, dedupKey });
  } else {
    emitSocialOutboxFailure({ userId, action, revert });
  }
}

export async function fetchMyProfile(
  userId: string
): Promise<ProfileCard | null> {
  try {
    const row = await guardedTablesDB.getRow({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId: APPWRITE_CONFIG.tables.profiles,
      rowId: `profile_${userId}`,
    });
    if (!row || (row as Record<string, unknown>).deleted === true) return null;
    return row as unknown as ProfileCard;
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 404) return null;
    console.error('[social] fetchMyProfile failed:', err);
    throw err;
  }
}

export async function fetchProfileByUserId(
  userId: string
): Promise<ProfileCard | null> {
  return fetchMyProfile(userId);
}

export async function createOrUpdateProfile(
  input: MyProfileInput
): Promise<ProfileCard> {
  const now = new Date().toISOString();
  const rowId = `profile_${input.userId}`;
  const data = {
    user_id: input.userId,
    username: input.username.toLowerCase(),
    display_name: input.displayName || '',
    avatar_file_id: input.avatarFileId || '',
    bio: input.bio || '',
    is_searchable: true,
    created_at: now,
    updated_at: now,
    deleted: false,
  };
  const op: SocialOutboxRemoteOp = {
    kind: 'upsertRow',
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.profiles,
    rowId,
    data,
    permissions: buildProfileRowPermissions(input.userId),
  };
  try {
    const row = await guardedTablesDB.upsertRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
      permissions: op.permissions,
    });
    if (DEBUG) console.log('[social] Profile upserted:', rowId);
    return row as unknown as ProfileCard;
  } catch (err) {
    if (isUnauthorizedError(err)) throw err;
    if (isTransientSocialFailure(err)) {
      enqueueSocialOp(input.userId, {
        action: 'upsert_profile',
        op,
        revert: { myRowId: '' },
        dedupKey: `upsert_profile:${input.userId}`,
      });
      // Distinguishable error — SetUsernameSheet branches on it to show an
      // "offline" message instead of a generic "could not save".
      throw new OfflineError(
        "You're offline. Reconnect to save your profile."
      );
    }
    throw err;
  }
}

/**
 * Returns:
 *   true  — username is available
 *   false — username is taken
 *   null  — could not determine (session expired, network failure, or
 *           server error). Callers MUST branch on null before showing a
 *           "username taken" error.
 */
export async function isUsernameAvailable(
  username: string
): Promise<boolean | null> {
  try {
    const res = await guardedTablesDB.listRows({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId: APPWRITE_CONFIG.tables.profiles,
      queries: [
        Query.equal('username', username.toLowerCase()),
        Query.limit(1),
      ],
    });
    return (res.rows || []).length === 0;
  } catch (err) {
    if (isUnauthorizedError(err)) return null;
    console.error('[social] isUsernameAvailable failed:', err);
    return null;
  }
}

export async function searchProfiles(
  query: string,
  excludeUserId: string,
  limit = 10
): Promise<ProfileCard[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 1) return [];
  const res = await guardedTablesDB.listRows({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.profiles,
    queries: [
      Query.startsWith('username', trimmed),
      Query.equal('deleted', false),
      Query.limit(limit),
    ],
  });
  const rows = (res.rows || []) as unknown as ProfileCard[];
  return rows.filter((r) => r.user_id !== excludeUserId);
}

export interface SendRequestInput {
  myUserId: string;
  myUsername: string;
  myDisplayName: string;
  myAvatarFileId: string;
  myBio: string;
  friend: ProfileCard;
}

export async function sendFriendRequest(
  input: SendRequestInput
): Promise<void> {
  const {
    myUserId,
    myUsername,
    myDisplayName,
    myAvatarFileId,
    myBio,
    friend,
  } = input;
  const now = new Date().toISOString();
  const db = getDatabase();
  const myRowId = await makeFriendshipId(myUserId, friend.user_id);
  const friendRowId = await makeFriendshipId(friend.user_id, myUserId);
  const myLocalRow: FriendshipDocument = {
    id: myRowId,
    userId: myUserId,
    friendId: friend.user_id,
    friendUsername: friend.username,
    friendDisplayName: friend.display_name || friend.username,
    friendAvatarFileId: friend.avatar_file_id || '',
    friendBio: friend.bio || '',
    status: 'pending_outgoing',
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.friendships.upsert(myLocalRow);

  const op: SocialOutboxRemoteOp = {
    kind: 'upsertRow',
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.friendships,
    rowId: friendRowId,
    data: {
      user_id: friend.user_id,
      friend_id: myUserId,
      friend_username: myUsername,
      friend_display_name: myDisplayName,
      friend_avatar_file_id: myAvatarFileId,
      friend_bio: myBio,
      status: 'pending_incoming',
      created_at: now,
      updated_at: now,
      deleted: false,
    },
    permissions: buildCreatorOwnPermissions(myUserId),
  };

  try {
    await guardedTablesDB.upsertRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
      permissions: op.permissions,
    });
    if (DEBUG)
      console.log('[social] Friend request sent:', myRowId, friendRowId);
  } catch (err) {
    handleSocialRemoteFailure({
      err,
      userId: myUserId,
      action: 'send_request',
      op,
      revert: { myRowId },
      dedupKey: `send_request:${friend.user_id}`,
    });
  }
}

export async function acceptFriendRequest(
  myUserId: string,
  friendUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const db = getDatabase();
  const myRowId = await makeFriendshipId(myUserId, friendUserId);
  const friendRowId = await makeFriendshipId(friendUserId, myUserId);
  const localDoc = await db.friendships.findOne(myRowId).exec();
  const previousStatus: FriendshipDocument['status'] =
    (localDoc?.status as FriendshipDocument['status'] | undefined) ??
    'pending_incoming';
  if (localDoc) {
    await localDoc.patch({ status: 'accepted', updatedAt: now });
  }

  const op: SocialOutboxRemoteOp = {
    kind: 'updateRow',
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.friendships,
    rowId: friendRowId,
    data: { status: 'accepted', updated_at: now },
  };

  try {
    await guardedTablesDB.updateRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
    });
    if (DEBUG) console.log('[social] Friend request accepted:', myRowId);
  } catch (err) {
    handleSocialRemoteFailure({
      err,
      userId: myUserId,
      action: 'accept_friend_request',
      op,
      revert: { myRowId, previousStatus },
      dedupKey: `accept_friend_request:${friendUserId}`,
    });
  }
}

export async function deleteFriendPair(
  myUserId: string,
  friendUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const db = getDatabase();
  const myRowId = await makeFriendshipId(myUserId, friendUserId);
  const friendRowId = await makeFriendshipId(friendUserId, myUserId);
  const localDoc = await db.friendships.findOne(myRowId).exec();
  if (localDoc) {
    await localDoc.patch({ isDeleted: true, updatedAt: now });
  }

  const op: SocialOutboxRemoteOp = {
    kind: 'updateRow',
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.friendships,
    rowId: friendRowId,
    data: { deleted: true, updated_at: now },
  };

  try {
    await guardedTablesDB.updateRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
    });
    if (DEBUG) console.log('[social] Friend pair soft-deleted:', myRowId);
  } catch (err: unknown) {
    // A 404 on the friend's row means there is nothing left to delete. The
    // local side is already soft-deleted, so no queue entry is needed.
    const code = (err as { code?: number })?.code;
    if (code === 404) {
      if (DEBUG)
        console.log(
          '[social] deleteFriendPair: friend row already 404, skipping'
        );
      return;
    }
    handleSocialRemoteFailure({
      err,
      userId: myUserId,
      action: 'delete_friend_pair',
      op,
      revert: { myRowId },
      dedupKey: `delete_friend_pair:${friendUserId}`,
    });
  }
}

export async function blockFriend(
  myUserId: string,
  friendUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const db = getDatabase();
  const myRowId = await makeFriendshipId(myUserId, friendUserId);
  const friendRowId = await makeFriendshipId(friendUserId, myUserId);
  const localDoc = await db.friendships.findOne(myRowId).exec();
  const previousStatus: FriendshipDocument['status'] =
    (localDoc?.status as FriendshipDocument['status'] | undefined) ??
    'accepted';
  if (localDoc) {
    await localDoc.patch({ status: 'blocked', updatedAt: now });
  }

  const op: SocialOutboxRemoteOp = {
    kind: 'updateRow',
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.friendships,
    rowId: friendRowId,
    data: { status: 'blocked', updated_at: now },
  };

  try {
    await guardedTablesDB.updateRow({
      databaseId: op.databaseId,
      tableId: op.tableId,
      rowId: op.rowId,
      data: op.data,
    });
  } catch (err) {
    handleSocialRemoteFailure({
      err,
      userId: myUserId,
      action: 'block_friend',
      op,
      revert: { myRowId, previousStatus },
      dedupKey: `block_friend:${friendUserId}`,
    });
  }
}

export function hasRecentTimestamp(iso: string, thresholdMs = 5000): boolean {
  return Date.now() - toMs(iso) < thresholdMs;
}

export async function updateFriendBioLocally(
  friendshipDocId: string,
  bio: string
): Promise<void> {
  try {
    const db = getDatabase();
    const doc = await db.friendships.findOne(friendshipDocId).exec();
    if (doc && (!doc.friendBio || doc.friendBio === '')) {
      await doc.patch({ friendBio: bio });
    }
  } catch (err) {
    console.warn('[social] updateFriendBioLocally failed:', err);
  }
}
