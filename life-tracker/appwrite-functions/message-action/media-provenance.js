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
    ¶»§q«^