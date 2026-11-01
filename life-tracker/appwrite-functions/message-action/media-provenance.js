'use strict';

// This registry records server-minted upload identities. It intentionally has
// NO delete operation: registration never proves the reference graph is clear.
const { randomBytes } = require('node:crypto');
const { Query } = require('node-appwrite');
const { soleOwnerControl } = require('./owner-media-audit');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLE_ID = 'media_uploads';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const PURPOSES = new Set(['tasks', 'diary', 'profile', 'chat']);
const ID_RE = /^img_[0-9a-f]{32}$/;
const RESERVATION_MS = 60 * 60 * 1000;
const MAX_SIZE = 5_000_000;

function result(status, body) { return { status, body }; }
function validUser(userId) {
  return typeof userId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(userId);
}

async function reserveMediaUpload({ db, callerId, purpose, now = Date.now() }) {
  if (!validUser(callerId)) return result(401, { error: 'Unauthorized' });
  if (!PURPOSES.has(purpose)) return result(400, { error: 'Invalid media purpose' });
  const fileId = 'img_' + randomBytes(16).toString('hex');
  const reservedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + RESERVATION_MS).toISOString();
  // Server-only table and server-generated opaque ID. Never store user-supplied
  // owner IDs or allow browser writes to this table.
  await db.createRow({
    databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: fileId,
    data: {
      owner_id: callerId, file_id: fileId, purpose, status: 'reserved',
      reserved_at: reservedAt, expires_at: expiresAt,
    },
    permissions: [],
  });
  return result(200, { fileId, purpose, expiresAt, deletionAuthorized: false });
}

async function confirmMediaUpload({ db, storage, callerId, fileId, now = Date.now() }) {
  if (!validUser(callerId)) return result(401, { error: 'Unauthorized' });
  if (!ID_RE.test(fileId || '')) return result(400, { error: 'Invalid media ID' });
  let row;
  try {
    row = await db.getRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: fileId });
  } catch (err) {
    if (Number(err?.code) === 404) return result(404, { error: 'Media reservation unavailable' });
    throw err;
  }
  if (row?.owner_id !== callerId || row?.file_id !== fileId) {
    return result(403, { error: 'Forbidden' });
  }
  if (row.status !== 'reserved' && row.status !== 'verified') {
    return result(409, { error: 'Media reservation unavailable' });
  }
  const issued = Date.parse(row.reserved_at || '');
  const expires = Date.parse(row.expires_at || '');
  if (!Number.isFinite(issued) || !Number.isFinite(expires) ||
      issued > now || expires - issued !== RESERVATION_MS ||
      (row.status === 'reserved' && now > expires)) {
    return result(409, { error: 'Media reservation expired or invalid' });
  }
  let file;
  try {
    file = await storage.getFile({ bucketId: BUCKET_ID, fileId });
  } catch (err) {
    if (Number(err?.code) === 404) return result(409, { error: 'Media upload not complete' });
    throw err;
  }
  const fileCreated = Date.parse(file?.$createdAt || '');
  if (file?.$id !== fileId || !soleOwnerControl(file.$permissions, callerId) ||
      !Number.isSafeInteger(file.sizeOriginal) || file.sizeOriginal <= 0 ||
      file.sizeOriginal > MAX_SIZE ||
      typeof file.mimeType !== 'string' || !file.mimeType.startsWith('image/') ||
      !Number.isFinite(fileCreated) || fileCreated < issued - 10_000 ||
      fileCreated > now + 10_000) {
    return result(409, { error: 'Media identity or permissions unverified' });
  }
  if (row.status === 'verified') {
    return result(200, { fileId, status: 'verified', deletionAuthorized: false });
  }
  const updated = await db.updateRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.equal('$id', fileId), Query.equal('owner_id', callerId),
      Query.equal('status', 'reserved')],
    data: { status: 'verified', verified_at: new Date(now).toISOString(),
      file_created_at: file.$createdAt, size_bytes: file.sizeOriginal },
  });
  if (updated?.total !== 1) {
    // A concurrent confirmation may have won; fail closed rather than
    // accepting ambiguous multi-row updates or a racing status change.
    return result(409, { error: 'Media reservation changed' });
  }
  return result(200, { fileId, status: 'verified', deletionAuthorized: false });
}

module.exports = { reserveMediaUpload, confirmMediaUpload, RESERVATION_MS };
