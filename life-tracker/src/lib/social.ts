import { TablesDB, Permission, Role, Query } from 'appwrite';
import { client } from './appwrite';
import { getDatabase } from '../db/database';
import type { FriendshipDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;

const APPWRITE_CONFIG = {
  databaseId: 'life_tracker',
  tables: {
    profiles: 'profiles',
    friendships: 'friendships',
  },
} as const;

const tablesDB = new TablesDB(client);

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

export async function fetchMyProfile(
  userId: string
): Promise<ProfileCard | null> {
  try {
    const row = await tablesDB.getRow({
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
  const row = await tablesDB.upsertRow({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.profiles,
    rowId,
    data,
    permissions: buildProfileRowPermissions(input.userId),
  });
  if (DEBUG) console.log('[social] Profile upserted:', rowId);
  return row as unknown as ProfileCard;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const res = await tablesDB.listRows({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId: APPWRITE_CONFIG.tables.profiles,
      queries: [
        Query.equal('username', username.toLowerCase()),
        Query.limit(1),
      ],
    });
    return (res.rows || []).length === 0;
  } catch (err) {
    console.error('[social] isUsernameAvailable failed:', err);
    return false;
  }
}

export async function searchProfiles(
  query: string,
  excludeUserId: string,
  limit = 10
): Promise<ProfileCard[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 1) return [];
  try {
    const res = await tablesDB.listRows({
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
  } catch (err) {
    console.error('[social] searchProfiles failed:', err);
    throw err;
  }
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

  await tablesDB.upsertRow({
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
  });
  if (DEBUG) console.log('[social] Friend request sent:', myRowId, friendRowId);
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
  if (localDoc) {
    await localDoc.patch({ status: 'accepted', updatedAt: now });
  }

  await tablesDB.updateRow({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.tables.friendships,
    rowId: friendRowId,
    data: { status: 'accepted', updated_at: now },
  });
  if (DEBUG) console.log('[social] Friend request accepted:', myRowId);
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

  try {
    await tablesDB.updateRow({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId: APPWRITE_CONFIG.tables.friendships,
      rowId: friendRowId,
      data: { deleted: true, updated_at: now },
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code !== 404) {
      console.warn('[social] deleteFriendPair remote failed:', err);
    }
  }
  if (DEBUG) console.log('[social] Friend pair soft-deleted:', myRowId);
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
  if (localDoc) {
    await localDoc.patch({ status: 'blocked', updatedAt: now });
  }

  try {
    await tablesDB.updateRow({
      databaseId: APPWRITE_CONFIG.databaseId,
      tableId: APPWRITE_CONFIG.tables.friendships,
      rowId: friendRowId,
      data: { status: 'blocked', updated_at: now },
    });
  } catch (err) {
    console.warn('[social] blockFriend remote update failed:', err);
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