// Isolated synthetic-only encrypted Diary transport (#1662).
// Admin/Functions see ciphertext and routing metadata, NEVER a root or PIN.
// OFF unless explicitly enabled on the exact Oracle Scratch project.
const crypto = require('node:crypto');
const { Query, Permission, Role } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const PILOT_PROJECT_ID = '6ae94a2100014d01f5ed';
const DIARY_TABLE = 'private_diary_ciphertexts';
const ROOT_TABLE = 'account_crypto_envelopes';
const opaque = /^p_[a-f0-9]{32}$/;
const keyId = /^k_[a-f0-9]{32}$/;
const revisionId = /^r_[a-f0-9]{32}$/;
const operationId = /^o_[a-f0-9]{32}$/;
const b64re = /^[A-Za-z0-9_-]+$/;
const response = (status, body) => ({ status, body });

function canonicalBase64url(input, byteCount, maxLength) {
  if (typeof input !== 'string' || !b64re.test(input) ||
      input.length < 2 || input.length > maxLength) return false;
  const raw = Buffer.from(input, 'base64url');
  return raw.length >= (byteCount || 1) &&
    (byteCount === undefined || raw.length === byteCount) &&
    raw.toString('base64url') === input;
}
function exactObject(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(k => Object.prototype.hasOwnProperty.call(value, k));
}
function recordEnvelope(value) {
  return exactObject(value, ['v','alg','kid','revision','iv','ct']) &&
    value.v === 1 && value.alg === 'A256GCM' &&
    keyId.test(value.kid) && revisionId.test(value.revision) &&
    canonicalBase64url(value.iv, 12, 16) &&
    canonicalBase64url(value.ct, undefined, 180000) &&
    Buffer.from(value.ct, 'base64url').length >= 16 &&
    Buffer.from(value.ct, 'base64url').length <= 131088;
}
function recoveryEnvelope(value) {
  return exactObject(value, ['v','alg','kid','iv','ct']) &&
    value.v === 1 && value.alg === 'A256GCM' &&
    keyId.test(value.kid) &&
    canonicalBase64url(value.iv, 12, 16) &&
    canonicalBase64url(value.ct, 48, 64);
}
function rootRowId(callerId) {
  return 'ke_' + crypto.createHash('sha256').update('mosaic-pilot|' + callerId)
    .digest('hex').slice(0, 32);
}
async function readOwned(db, callerId, tableId, rowId) {
  let row;
  try {
    row = await db.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (e) {
    if (Number(e?.code) === 404) return response(404, { error: 'Not found' });
    throw e;
  }
  if (row?.user_id !== callerId) return response(403, { error: 'Forbidden' });
  return row;
}
function publicRow(row) {
  return {
    rowId: row.$id, revision: row.revision, keyId: row.key_id,
    envelope: row.envelope, deleted: row.deleted === true,
    updatedAt: row.updated_at,
  };
}
async function createRoot(db, callerId, payload) {
  if (!recoveryEnvelope(payload.envelope)) {
    return response(400, { error: 'Invalid encrypted recovery envelope' });
  }
  const rowId = rootRowId(callerId), envelope = JSON.stringify(payload.envelope);
  const now = new Date().toISOString();
  try {
    await db.createRow({
      databaseId: DATABASE_ID, tableId: ROOT_TABLE, rowId,
      data: {
        user_id: callerId, key_id: payload.envelope.kid,
        envelope, generation: 1, created_at: now, updated_at: now,
      },
      permissions: [Permission.read(Role.user(callerId))],
    });
    return response(200, { ok: true, status: 'created' });
  } catch (cause) {
    if (Number(cause?.code) !== 409) throw cause;
    const row = await readOwned(db, callerId, ROOT_TABLE, rowId);
    if (row?.status) return row;
    if (row.envelope === envelope && row.key_id === payload.envelope.kid) {
      return response(200, { ok: true, status: 'duplicate' });
    }
    return response(409, { error: 'Encryption root already exists; do not replace' });
  }
}
async function readRoot(db, callerId) {
  const row = await readOwned(db, callerId, ROOT_TABLE, rootRowId(callerId));
  if (row?.status) return row;
  if (!recoveryEnvelope(JSON.parse(row.envelope || '{}')) || row.generation !== 1) {
    return response(409, { error: 'Unsupported encrypted root envelope' });
  }
  return response(200, { ok: true, envelope: JSON.parse(row.envelope) });
}
async function writeDiary(db, callerId, payload) {
  const { rowId, opId, envelope, expectedRevision, deleted } = payload;
  if (!opaque.test(rowId || '') || !operationId.test(opId || '') ||
      !recordEnvelope(envelope) || (deleted !== undefined && typeof deleted !== 'boolean') ||
      (expectedRevision !== undefined && expectedRevision !== null &&
       !revisionId.test(expectedRevision))) {
    return response(400, { error: 'Invalid encrypted Diary operation' });
  }
  const serialized = JSON.stringify(envelope);
  const now = new Date().toISOString();
  const data = {
    user_id: callerId, key_id: envelope.kid, revision: envelope.revision,
    envelope: serialized, op_id: opId, updated_at: now, deleted: deleted === true,
  };
  if (expectedRevision === undefined || expectedRevision === null) {
    try {
      await db.createRow({
        databaseId: DATABASE_ID, tableId: DIARY_TABLE, rowId,
        data: { ...data, created_at: now },
        permissions: [Permission.read(Role.user(callerId))],
      });
      return response(200, { ok: true, status: 'created', revision: envelope.revision });
    } catch (cause) {
      if (Number(cause?.code) !== 409) throw cause;
    }
  }
  const existing = await readOwned(db, callerId, DIARY_TABLE, rowId);
  if (existing?.status) return existing;
  if (existing.op_id === opId && existing.envelope === serialized &&
      existing.deleted === (deleted === true)) {
    return response(200, { ok: true, status: 'duplicate', revision: existing.revision });
  }
  if (expectedRevision === undefined || expectedRevision === null ||
      existing.revision !== expectedRevision ||
      envelope.revision === expectedRevision ||
      envelope.kid !== existing.key_id) {
    return response(409, { ok: false, status: 'conflict', row: publicRow(existing) });
  }
  // Conditional update is atomic against the observed revision, not a prior GET.
  const out = await db.updateRows({
    databaseId: DATABASE_ID, tableId: DIARY_TABLE,
    queries: [
      Query.equal('$id', rowId), Query.equal('user_id', callerId),
      Query.equal('revision', expectedRevision),
    ],
    data,
  });
  const affected = typeof out?.total === 'number' ? out.total : out?.rows?.length ?? 0;
  if (affected === 1) return response(200, { ok: true, status: 'updated', revision: envelope.revision });
  if (affected > 1) throw new Error('Encrypted Diary CAS affected multiple records');
  const newer = await readOwned(db, callerId, DIARY_TABLE, rowId);
  if (newer?.status) return newer;
  return response(409, { ok: false, status: 'conflict', row: publicRow(newer) });
}
async function getDiary(db, callerId, payload) {
  if (!opaque.test(payload.rowId || '')) return response(400, { error: 'Invalid encrypted Diary ID' });
  const row = await readOwned(db, callerId, DIARY_TABLE, payload.rowId);
  if (row?.status) return row;
  return response(200, { ok: true, row: publicRow(row) });
}
async function listDiary(db, callerId, payload) {
  if (payload.after !== undefined && !opaque.test(payload.after || '')) {
    return response(400, { error: 'Invalid encrypted Diary cursor' });
  }
  const queries = [
    Query.equal('user_id', callerId), Query.orderAsc('$id'), Query.limit(20),
  ];
  if (payload.after) queries.push(Query.cursorAfter(payload.after));
  const page = await db.listRows({
    databaseId: DATABASE_ID, tableId: DIARY_TABLE, queries, total: false,
  });
  const rows = (page.rows || []).filter(row => row.user_id === callerId).slice(0, 20);
  return response(200, {
    ok: true, rows: rows.map(publicRow),
    after: rows.length === 20 ? rows[19].$id : null,
  });
}
async function handleE2eeDiaryPilot(db, callerId, payload) {
  if (process.env.APPWRITE_FUNCTION_PROJECT_ID !== PILOT_PROJECT_ID ||
      process.env.MOSAIC_E2EE_PILOT_ENABLED !== 'true') {
    return response(404, { error: 'Unavailable' });
  }
  if (typeof callerId !== 'string' || !callerId ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(callerId)) {
    return response(401, { error: 'Unauthorized' });
  }
  if (payload.ownerId !== undefined && payload.ownerId !== callerId) {
    return response(403, { error: 'Forbidden' });
  }
  switch (payload.operation) {
    case 'create_root': return createRoot(db, callerId, payload);
    case 'read_root': return readRoot(db, callerId);
    case 'put': return writeDiary(db, callerId, payload);
    case 'get': return getDiary(db, callerId, payload);
    case 'list': return listDiary(db, callerId, payload);
    default: return response(400, { error: 'Invalid encrypted Diary operation' });
  }
}
module.exports = { handleE2eeDiaryPilot };
