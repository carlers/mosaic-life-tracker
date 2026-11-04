const crypto = require('crypto');
const { Query } = require('node-appwrite');
const { idFor } = require('./friendship');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const CONTROLS = 'social_discovery_controls';
const FRIENDSHIPS = process.env.APPWRITE_TABLE_FRIENDSHIPS || 'friendships';
const PROFILES = process.env.APPWRITE_TABLE_PROFILES || 'profiles';
const MAX_SCAN = 60;
const MAX_RESULT = 20;
const MAX_REQUESTS_PER_MINUTE = 30;
// Instance-local excess-load guard. Authorization and bounded scanning are independent
// of this best-effort limit; infrastructure-level rate limiting remains required.
const requests = new Map();
const ok = body => ({ status: 200, body: { ok: true, ...body } });
const fail = (status, error = 'Unavailable') => ({ status, body: { error } });
const validUserId = value => typeof value === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/.test(value);
const rowId = id => 'disc_' + crypto.createHash('sha256').update(id).digest('hex').slice(0, 30);

async function read(db, tableId, id, transactionId) {
  try { return await db.getRow({ databaseId: DATABASE_ID, tableId, rowId: id, transactionId }); }
  catch (error) { if (error.code === 404) return null; throw error; }
}
const active = row => !!row && row.deleted !== true;
const accepted = row => active(row) && row.status === 'accepted';
const controlsOf = row => ({
  allowBrowse: row?.allow_browse === true,
  allowAppear: row?.allow_appear === true,
  version: row?.updated_at || '',
});

async function getControls(db, userId, tx) {
  const row = await read(db, CONTROLS, rowId(userId), tx);
  if (row && row.user_id !== userId) throw new Error('Discovery control ownership mismatch');
  return row;
}

async function handleGetSocialDiscoveryControls(db, caller) {
  if (!validUserId(caller)) return fail(401);
  const row = await getControls(db, caller);
  return ok(controlsOf(row));
}

async function handleSetSocialDiscoveryControls(db, caller, payload) {
  const { field, value, expectedVersion } = payload;
  if (!validUserId(caller) || !['allowBrowse', 'allowAppear'].includes(field) ||
      typeof value !== 'boolean' || typeof expectedVersion !== 'string' ||
      expectedVersion.length > 50) return fail(400, 'Invalid discovery preference');
  const key = field === 'allowBrowse' ? 'allow_browse' : 'allow_appear';
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await db.createTransaction({ ttl: 60 });
    let committed = false;
    try {
      const previous = await getControls(db, caller, tx.$id);
      if ((previous?.updated_at || '') !== expectedVersion) {
        return { status: 409, body: { error: 'Discovery preference changed', ...controlsOf(previous) } };
      }
      const now = new Date(Math.max(Date.now(), Date.parse(previous?.updated_at || '') + 1 || 0)).toISOString();
      if (previous) {
        await db.updateRow({ databaseId: DATABASE_ID, tableId: CONTROLS, rowId: rowId(caller),
          data: { [key]: value, updated_at: now }, transactionId: tx.$id });
      } else {
        await db.createRow({ databaseId: DATABASE_ID, tableId: CONTROLS, rowId: rowId(caller),
          data: { user_id: caller, allow_browse: field === 'allowBrowse' ? value : false,
            allow_appear: field === 'allowAppear' ? value : false, updated_at: now },
          permissions: [], transactionId: tx.$id });
      }
      await db.updateTransaction({ transactionId: tx.$id, commit: true });
      committed = true;
      return ok({ ...controlsOf({ ...previous, [key]: value, updated_at: now }) });
    } catch (e) {
      if (e.code !== 409 || attempt === 2) throw e;
    } finally {
      if (!committed) await db.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
    }
  }
  return fail(409, 'Discovery preference changed');
}

async function pairAccepted(db, a, b) {
  if (!validUserId(a) || !validUserId(b) || a === b) return false;
  const [ab, ba] = await Promise.all([
    read(db, FRIENDSHIPS, idFor(a, b)),
    read(db, FRIENDSHIPS, idFor(b, a)),
  ]);
  return ab?.user_id === a && ab.friend_id === b && accepted(ab) &&
    ba?.user_id === b && ba.friend_id === a && accepted(ba);
}

function signCursor(payload) {
  const key = process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET;
  if (!key || key.length < 32) return null;
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', key).update(value).digest('base64url');
  return value + '.' + mac;
}
function parseCursor(cursor, viewer, via) {
  if (!cursor) return '';
  if (typeof cursor !== 'string' || cursor.length > 400) return null;
  const [value, mac] = cursor.split('.');
  const key = process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET;
  if (!value || !mac || !key || key.length < 32) return null;
  const expected = crypto.createHmac('sha256', key).update(value).digest();
  let provided;
  try { provided = Buffer.from(mac, 'base64url'); }
  catch { return null; }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed.viewer !== viewer || parsed.via !== via ||
        !validUserId(parsed.after) && !/^fr_[a-f0-9]{32}$/.test(parsed.after) ||
        !Number.isSafeInteger(parsed.exp) || parsed.exp < Date.now() ||
        parsed.exp > Date.now() + 10 * 60_000) return null;
    return parsed.after;
  } catch { return null; }
}

function checkRate(caller) {
  const now = Date.now();
  if (requests.size > 4096) requests.clear();
  const recent = (requests.get(caller) || []).filter(t => now - t < 60_000);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return false;
  recent.push(now); requests.set(caller, recent);
  return true;
}

async function eligibleCandidate(db, viewer, via, candidate, accountDeletionPending) {
  const id = candidate.friend_id;
  if (!validUserId(id) || id === viewer || id === via || !accepted(candidate) ||
      candidate.user_id !== via || await accountDeletionPending(db, id)) return null;
  const [reverse, consent, profile, myPair, theirPair] = await Promise.all([
    read(db, FRIENDSHIPS, idFor(id, via)),
    getControls(db, id),
    read(db, PROFILES, 'profile_' + id),
    read(db, FRIENDSHIPS, idFor(viewer, id)),
    read(db, FRIENDSHIPS, idFor(id, viewer)),
  ]);
  if (!accepted(reverse) || reverse.user_id !== id || reverse.friend_id !== via ||
      !consent || consent.allow_appear !== true ||
      !active(profile) || profile.user_id !== id || profile.is_searchable !== true) return null;
  if ([myPair, theirPair].some(row => active(row) && row.status === 'blocked') ||
      (accepted(myPair) && accepted(theirPair))) return null;
  const status = active(myPair) ? myPair.status : '';
  return {
    user_id: id, username: profile.username || '',
    display_name: profile.display_name || profile.username || '',
    avatar_file_id: profile.avatar_file_id || '',
    bio: profile.bio || '',
    relationship: status === 'pending_outgoing' ? 'outgoing' :
      status === 'pending_incoming' ? 'incoming' : 'none',
  };
}

async function handleListFriendConnections(db, caller, payload, accountDeletionPending) {
  if (process.env.MOSAIC_SOCIAL_DISCOVERY_ENABLED !== 'true') return fail(503, 'Discovery unavailable');
  if (!validUserId(caller) || !validUserId(payload.viaFriendId) || caller === payload.viaFriendId) return fail(400);
  if (!process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET ||
      process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET.length < 32) return fail(503, 'Discovery unavailable');
  const limit = payload.limit === undefined ? 12 : payload.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULT) return fail(400);
  const after = parseCursor(payload.cursor || '', caller, payload.viaFriendId);
  if (after === null) return fail(400, 'Invalid page cursor');
  if (!checkRate(caller)) return fail(429, 'Try again later');
  const via = payload.viaFriendId;
  // Recheck authorization on every request and after the candidate scan.
  if (await accountDeletionPending(db, via) || !await pairAccepted(db, caller, via) ||
      (await getControls(db, via))?.allow_browse !== true) return fail(404);
  const source = await db.listRows({ databaseId: DATABASE_ID, tableId: FRIENDSHIPS,
    queries: [Query.equal('user_id', via), Query.equal('status', 'accepted'),
      Query.equal('deleted', false), Query.orderAsc('$id'), Query.limit(MAX_SCAN),
      ...(after ? [Query.cursorAfter(after)] : [])], total: false });
  const found = [];
  let last = '';
  // Limit work per request; never return raw rows or hidden result counts.
  for (const row of source.rows || []) {
    last = row.$id || '';
    const person = await eligibleCandidate(db, caller, via, row, accountDeletionPending);
    if (person) found.push(person);
    if (found.length >= limit) break;
  }
  if (await accountDeletionPending(db, via) || !await pairAccepted(db, caller, via) ||
      (await getControls(db, via))?.allow_browse !== true) return fail(404);
  // Only expose a continuation when there were enough visible results to
  // fill a page. Never leak the count of hidden or blocked friendships.
  const nextCursor = found.length >= limit && last
    ? signCursor({ viewer: caller, via, after: last, exp: Date.now() + 5 * 60_000 }) : null;
  return ok({ items: found, nextCursor: nextCursor || '' });
}

module.exports = {
  handleGetSocialDiscoveryControls, handleSetSocialDiscoveryControls,
  handleListFriendConnections, pairAccepted, parseCursor, signCursor,
};
