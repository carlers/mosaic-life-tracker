const { createHash } = require('crypto');
const { Permission, Role, Query } = require('node-appwrite');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLE = process.env.APPWRITE_TABLE_FRIENDSHIPS || 'friendships';
const PROFILES = process.env.APPWRITE_TABLE_PROFILES || 'profiles';
const operations = new Set(['send', 'accept', 'decline', 'cancel', 'remove', 'block']);
const idFor = (owner, friend) => `fr_${createHash('sha256').update(`${owner}|${friend}`).digest('hex').slice(0, 32)}`;
const permissionsFor = (owner) => [Permission.read(Role.user(owner))];
const version = (row) => row?.updated_at || null;
const live = (row) => row && !row.deleted;
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/.test(id);
async function read(db, tableId, rowId, transactionId) {
  try { return await db.getRow({ databaseId: DATABASE_ID, tableId, rowId, transactionId }); }
  catch (error) { if (error.code === 404) return null; throw error; }
}
function rowData(owner, friend, profile, status, now, previous) {
  return {
    user_id: owner, friend_id: friend, status, deleted: false,
    friend_username: profile.username || '', friend_display_name: profile.display_name || profile.username || '',
    friend_avatar_file_id: profile.avatar_file_id || '', friend_bio: profile.bio || '',
    created_at: previous?.created_at || now, updated_at: now,
  };
}
async function write(db, rowId, data, previous, transactionId) {
  const args = { databaseId: DATABASE_ID, tableId: TABLE, rowId, data,
    permissions: permissionsFor(data.user_id), transactionId };
  return previous ? db.updateRow(args) : db.createRow(args);
}
async function handleFriendship(db, caller, payload) {
  const { friendUserId: friend, operation, expectedVersion } = payload;
  if (!validId(friend) || friend === caller || !operations.has(operation) ||
      !(expectedVersion === null || (typeof expectedVersion === 'string' && expectedVersion.length <= 50)) ||
      (payload.ownerId !== undefined && payload.ownerId !== caller)) {
    return { status: 400, body: { error: 'Invalid friendship command' } };
  }
  const myId = idFor(caller, friend), peerId = idFor(friend, caller);
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await db.createTransaction({ ttl: 60 });
    let committed = false;
    try {
      const mine = await read(db, TABLE, myId, tx.$id);
      const peer = await read(db, TABLE, peerId, tx.$id);
      const answer = (status, error) => ({ status, body: { ok: status === 200, row: mine, error } });
      // Do not trust a row ID alone when inspecting pre-migration records.
      if ((mine && (mine.user_id !== caller || mine.friend_id !== friend)) ||
          (peer && (peer.user_id !== friend || peer.friend_id !== caller))) return answer(409, 'Invalid friendship ownership');
      const blocked = [mine, peer].some(r => live(r) && r.status === 'blocked');
      const accepted = [mine, peer].every(r => live(r) && r.status === 'accepted');
      const incoming = live(mine) && mine.status === 'pending_incoming' && live(peer) && peer.status === 'pending_outgoing';
      const outgoing = live(mine) && mine.status === 'pending_outgoing' && live(peer) && peer.status === 'pending_incoming';
      const removed = mine?.deleted && peer?.deleted;
      // Safe lost-response retries: return the current state without writing it.
      if ((operation === 'send' && outgoing) || (operation === 'accept' && accepted) ||
          (operation === 'block' && [mine, peer].every(r => live(r) && r.status === 'blocked')) ||
          (['decline', 'cancel', 'remove'].includes(operation) && removed)) return answer(200);
      if (version(mine) !== expectedVersion) return answer(409, 'Friendship changed. Refresh and try again.');
      if (blocked) return answer(403, 'This relationship is blocked');
      if ((operation === 'send' && (live(mine) || live(peer))) ||
          (operation === 'accept' && !incoming) || (operation === 'decline' && !incoming) ||
          (operation === 'cancel' && !outgoing) || (operation === 'remove' && !accepted) ||
          (operation === 'block' && !accepted && !incoming && !outgoing)) return answer(409, 'Invalid friendship transition');
      if (operation === 'accept' || operation === 'block') {
        const me = await read(db, PROFILES, `profile_${caller}`, tx.$id);
        const them = await read(db, PROFILES, `profile_${friend}`, tx.$id);
        if (!me || me.deleted || !them || them.deleted) return answer(404, 'Profile unavailable');
      }
      const now = new Date(Math.max(Date.now(), Date.parse(version(mine) || '') + 1 || 0, Date.parse(version(peer) || '') + 1 || 0)).toISOString();
      let a, b;
      if (operation === 'send') {
        const me = await read(db, PROFILES, `profile_${caller}`, tx.$id);
        const them = await read(db, PROFILES, `profile_${friend}`, tx.$id);
        if (!me || me.deleted || !them || them.deleted || me.user_id !== caller || them.user_id !== friend) return answer(404, 'Profile unavailable');
        a = rowData(caller, friend, them, 'pending_outgoing', now, mine);
        b = rowData(friend, caller, me, 'pending_incoming', now, peer);
      } else {
        // Preserve profile snapshots and creation times; never use PUT/upsert.
        const patch = operation === 'accept' ? { status: 'accepted' } : operation === 'block' ? { status: 'blocked' } : { deleted: true };
        a = { user_id: caller, ...patch, updated_at: now };
        b = { user_id: friend, ...patch, updated_at: now };
      }
      await write(db, myId, a, mine, tx.$id);
      await write(db, peerId, b, peer, tx.$id);
      await db.updateTransaction({ transactionId: tx.$id, commit: true });
      committed = true;
      return { status: 200, body: { ok: true, row: { ...mine, ...a, $id: myId } } };
    } catch (error) {
      if (error.code !== 409 || attempt === 2) throw error;
    } finally {
      if (!committed) await db.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
    }
  }
}
async function deleteAccountFriendships(db, caller) {
  // Hide the profile before scanning: new sends cannot race account cleanup.
  const profile = await read(db, PROFILES, `profile_${caller}`);
  if (profile) await db.updateRow({ databaseId: DATABASE_ID, tableId: PROFILES,
    rowId: profile.$id || `profile_${caller}`, data: { deleted: true, is_searchable: false, updated_at: new Date().toISOString() } });
  const peers = new Set();
  for (const field of ['user_id', 'friend_id']) {
    let cursor;
    for (let page = 0; ; page++) {
      if (page === 100) throw new Error('Account friendship cleanup exceeded page limit');
      const result = await db.listRows({ databaseId: DATABASE_ID, tableId: TABLE,
        queries: [Query.equal(field, caller), Query.limit(100), Query.orderAsc('$id'), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
      for (const row of result.rows) peers.add(row.user_id === caller ? row.friend_id : row.user_id);
      if (result.rows.length < 100) break;
      cursor = result.rows.at(-1).$id;
    }
  }
  for (const peer of peers) {
    const tx = await db.createTransaction({ ttl: 60 });
    try {
      for (const [owner, friend] of [[caller, peer], [peer, caller]]) {
        const rowId = idFor(owner, friend);
        const row = await read(db, TABLE, rowId, tx.$id);
        if (row) await write(db, rowId, { user_id: owner, deleted: true, updated_at: new Date().toISOString() }, row, tx.$id);
      }
      await db.updateTransaction({ transactionId: tx.$id, commit: true });
    } catch (error) {
      await db.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
      throw error;
    }
  }
  return { status: 200, body: { ok: true } };
}
module.exports = { handleFriendship, deleteAccountFriendships, idFor, permissionsFor, read, write, rowData };
