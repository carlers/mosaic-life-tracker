'use strict';

// User-confirmed reclamation for newly server-verified files ONLY.
// Never touch imported/legacy files, chat media, unknown owners, or files
// still referenced anywhere in the server graph (including tombstones).
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { Query } = require('node-appwrite');
const { soleOwnerControl } = require('./owner-media-audit');
const { noReferences, referencedMediaIds } = require('./synthetic-media-cleanup');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLE_ID = 'media_uploads';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const FILE_RE = /^img_[0-9a-f]{32}$/;
const PURPOSES = new Set(['tasks', 'diary', 'profile']);
const GRACE_MS = 60_000;
const PAGE_SIZE = 15;
const result = (status, body) => ({ status, body });
const sha = (s) => createHash('sha256').update(s).digest('hex');
const allowed = () =>
  process.env.APPWRITE_FUNCTION_PROJECT_ID === '6a96e82d000d1310b3be' &&
  process.env.MOSAIC_1478_REAL_MEDIA_CLEANUP_ENABLED === 'true';

async function rowForOwner(db, callerId, fileId) {
  if (!callerId || typeof fileId !== 'string' || !FILE_RE.test(fileId)) {
    return { denied: result(400, { error: 'Invalid media identity' }) };
  }
  let row;
  try { row = await db.getRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: fileId }); }
  catch (error) {
    if (Number(error?.code) === 404) return { denied: result(404, { error: 'Media not eligible' }) };
    throw error;
  }
  if (row?.owner_id !== callerId || row?.file_id !== fileId || !PURPOSES.has(row?.purpose)) {
    return { denied: result(403, { error: 'Media not eligible' }) };
  }
  return { row };
}
async function fingerprint(storage, row, callerId) {
  let file;
  try { file = await storage.getFile({ bucketId: BUCKET_ID, fileId: row.file_id }); }
  catch (error) { if (Number(error?.code) === 404) return null; throw error; }
  if (file?.$id !== row.file_id || !soleOwnerControl(file.$permissions, callerId) ||
      file.$createdAt !== row.file_created_at || file.sizeOriginal !== row.size_bytes ||
      !Number.isSafeInteger(file.sizeOriginal) || file.sizeOriginal <= 0 ||
      typeof file.mimeType !== 'string' || !file.mimeType.startsWith('image/')) {
    throw Error('Media fingerprint mismatch');
  }
  return file;
}
async function transition(db, row, from, data, expectedTokenHash = null) {
  const changed = await db.updateRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.equal('$id', row.file_id), Query.equal('owner_id', row.owner_id),
      Query.equal('purpose', row.purpose), Query.equal('status', from),
      ...(expectedTokenHash ? [Query.equal('delete_token_hash', expectedTokenHash)] : [])],
    data,
  });
  return changed?.total === 1;
}

async function listOwnerReclaimableMedia({ db, storage, callerId }) {
  if (!callerId) return result(401, { error: 'Unauthorized' });
  if (!allowed()) return result(403, { error: 'Reclamation is unavailable' });
  const page = await db.listRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.equal('owner_id', callerId), Query.equal('status', ['verified','pending_delete']),
      Query.orderDesc('$createdAt'), Query.limit(PAGE_SIZE)],
    total: false,
  });
  if (!Array.isArray(page?.rows) || page.rows.length > PAGE_SIZE) {
    throw Error('Invalid private media inventory');
  }
  const candidates = [];
  const mediaIds = [];
  for (const row of page.rows) {
    if (row.owner_id !== callerId || row.file_id !== row.$id ||
        !FILE_RE.test(row.file_id) || !PURPOSES.has(row.purpose) ||
        !row.file_created_at || !row.verified_at) {
      throw Error('Invalid private media evidence');
    }
    mediaIds.push(row.file_id);
  }
  const referenced = await referencedMediaIds(db, mediaIds);
  for (const row of page.rows) {
    if (referenced.has(row.file_id)) continue;
    const file = await fingerprint(storage, row, callerId);
    if (file) {
      candidates.push({ fileId: row.file_id, purpose: row.purpose,
        bytes: row.size_bytes, uploadedAt: row.file_created_at, state: row.status });
    }
  }
  return result(200, { candidates, scanned: page.rows.length,
    hasMore: page.rows.length === PAGE_SIZE, coverage: 'new-verified-uploads-only' });
}

async function requestOwnerMediaCleanup({ db, storage, callerId, fileId, confirmIntent, now = Date.now() }) {
  if (!callerId) return result(401, { error: 'Unauthorized' });
  if (!allowed()) return result(403, { error: 'Reclamation is unavailable' });
  if (confirmIntent !== true) return result(400, { error: 'Explicit deletion intent required' });
  const { row, denied } = await rowForOwner(db, callerId, fileId);
  if (denied) return denied;
  if (!['verified','pending_delete'].includes(row.status) || !row.file_created_at || !row.verified_at) {
    return result(409, { error: 'Media is not verified' });
  }
  if (!await fingerprint(storage, row, callerId) || !await noReferences(db, fileId)) {
    return result(409, { error: 'Media is in use or missing' });
  }
  const token = randomBytes(32).toString('hex');
  if (!await transition(db, row, row.status, {
    status: 'pending_delete', delete_requested_at: new Date(now).toISOString(),
    delete_token_hash: sha(token),
  }, row.status === 'pending_delete' ? row.delete_token_hash : null)) return result(409, { error: 'Media changed during confirmation' });
  return result(200, { fileId, confirmationToken: token,
    notBefore: new Date(now + GRACE_MS).toISOString() });
}

async function confirmOwnerMediaCleanup({ db, storage, callerId, fileId, confirmationToken, now = Date.now() }) {
  if (!callerId) return result(401, { error: 'Unauthorized' });
  if (!allowed()) return result(403, { error: 'Reclamation is unavailable' });
  const { row, denied } = await rowForOwner(db, callerId, fileId);
  if (denied) return denied;
  if (row.status === 'deleted') return result(200, { fileId, status: 'deleted' });
  const expected = row.delete_token_hash;
  if (!['pending_delete', 'deleting'].includes(row.status) ||
      typeof confirmationToken !== 'string' || !/^[0-9a-f]{64}$/.test(confirmationToken) ||
      typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sha(confirmationToken), 'hex'))) {
    return result(409, { error: 'Confirmation unavailable' });
  }
  const since = Date.parse(row.delete_requested_at || '');
  if (!Number.isFinite(since) || since > now || now - since < GRACE_MS) {
    return result(409, { error: 'Recovery grace period pending' });
  }
  if (!await noReferences(db, fileId)) return result(409, { error: 'Media is referenced' });
  const file = await fingerprint(storage, row, callerId);
  if (!file && row.status === 'pending_delete') return result(409, { error: 'File disappeared before deletion' });
  if (row.status === 'pending_delete' &&
      !await transition(db, row, 'pending_delete', { status: 'deleting' }, expected)) {
    return result(409, { error: 'Concurrent cleanup changed state' });
  }
  if (file) {
    // A synchronized attachment may arrive while the private ledger moves
    // from pending_delete to deleting. Recheck AFTER the state transition.
    // This does not fence future writes queued on offline clients.
    let stillUnreferenced;
    try {
      stillUnreferenced = await noReferences(db, fileId);
    } catch (error) {
      // A failed scan never authorizes deletion. Best-effort rollback makes
      // the ticket resumable after an outage; even if CAS fails, bytes remain.
      try { await transition(db, row, 'deleting', { status: 'pending_delete' }, expected); }
      catch { /* Fail closed and preserve the original scanner error. */ }
      throw error;
    }
    if (!stillUnreferenced) {
      if (!await transition(db, row, 'deleting', { status: 'pending_delete' }, expected)) {
        return result(409, { error: 'Media changed while protecting references' });
      }
      return result(409, { error: 'Media became referenced during deletion' });
    }
    try { await storage.deleteFile({ bucketId: BUCKET_ID, fileId }); }
    catch (error) { if (Number(error?.code) !== 404) throw error; }
  }
  if (!await transition(db, row, 'deleting', {
    status: 'deleted', deleted_at: new Date(now).toISOString(),
    delete_receipt: sha(fileId + '|' + row.delete_requested_at),
  })) return result(409, { error: 'Receipt pending retry' });
  return result(200, { fileId, status: 'deleted' });
}

module.exports = { listOwnerReclaimableMedia, requestOwnerMediaCleanup,
  confirmOwnerMediaCleanup, GRACE_MS };
