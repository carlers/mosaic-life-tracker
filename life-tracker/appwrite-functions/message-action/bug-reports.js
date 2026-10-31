const crypto = require('crypto');
const { Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLE_ID = 'bug_reports';
const RETENTION_DAYS = 30;
const MAX_REPORTS_PER_HOUR = 5;
const DIAGNOSTICS = {
  version: 30, build: 40, browser: 30, os: 30,
  device: 16, pwa: 16, screen: 30,
};
function reportId(userId, requestId) {
  return 'bug_' + crypto.createHash('sha256')
    .update(userId + ':' + requestId).digest('hex').slice(0, 32);
}
function cleanText(raw, max, required) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if ((required && !value) || value.length > max) return null;
  return value;
}
function normalizeReport(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (typeof payload.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(payload.requestId)) return null;
  const title = cleanText(payload.title, 160, true);
  const description = cleanText(payload.description, 3000, true);
  const steps = cleanText(payload.steps === undefined ? '' : payload.steps, 2000, false);
  if (title === null || description === null || steps === null) return null;
  if (Object.keys(payload).some(key =>
    !['action', 'requestId', 'title', 'description', 'steps', 'diagnostics'].includes(key))) return null;
  let diagnostics = '';
  if (payload.diagnostics !== undefined) {
    const info = payload.diagnostics;
    if (!info || Array.isArray(info) || typeof info !== 'object' ||
        Object.keys(info).some(key => !(key in DIAGNOSTICS))) return null;
    const safe = {};
    for (const [key, max] of Object.entries(DIAGNOSTICS)) {
      if (!(key in info)) continue;
      if (typeof info[key] !== 'string' || info[key].length > max ||
          !/^[a-zA-Z0-9. _-]*$/.test(info[key])) return null;
      safe[key] = info[key];
    }
    diagnostics = JSON.stringify(safe);
    if (diagnostics.length > 512) return null;
  }
  return { title, description, steps, diagnostics };
}
function hashReport(report) {
  return crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
}
async function readOptional(db, id) {
  try {
    return await db.getRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id });
  } catch (cause) {
    if (Number(cause?.code) === 404) return null;
    throw cause;
  }
}
async function handleSubmitBugReport(db, callerId, payload, now = new Date()) {
  const report = normalizeReport(payload);
  if (!report) return { status: 400, body: { error: 'Invalid bug report' } };
  const id = reportId(callerId, payload.requestId);
  const digest = hashReport(report);
  const previous = await readOptional(db, id);
  if (previous) {
    return previous.user_id === callerId && previous.body_hash === digest
      ? { status: 200, body: { reportId: id, duplicate: true } }
      : { status: 409, body: { error: 'Report reference conflicts' } };
  }
  // Server-enforced sliding window; deterministic IDs also dedupe concurrent retries.
  const recent = await db.listRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.equal('user_id', callerId), Query.orderDesc('created_at'), Query.limit(6)],
    total: false,
  });
  const cutoff = now.getTime() - 60 * 60 * 1000;
  if ((recent.rows || []).filter(row => Date.parse(row.created_at) >= cutoff).length >= MAX_REPORTS_PER_HOUR) {
    return { status: 429, body: { error: 'Report limit reached. Try again later.' } };
  }
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 86400000).toISOString();
  try {
    await db.createRow({
      databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: id,
      data: { user_id: callerId, ...report, body_hash: digest,
        created_at: createdAt, expires_at: expiresAt },
      permissions: [],
    });
  } catch (cause) {
    if (Number(cause?.code) !== 409) throw cause;
    const raced = await readOptional(db, id);
    if (!raced) throw cause;
    return raced.user_id === callerId && raced.body_hash === digest
      ? { status: 200, body: { reportId: id, duplicate: true } }
      : { status: 409, body: { error: 'Report reference conflicts' } };
  }
  return { status: 201, body: { reportId: id, duplicate: false } };
}
async function pruneExpiredBugReports(db, now = new Date()) {
  let deleted = 0;
  const result = await db.listRows({
    databaseId: DATABASE_ID, tableId: TABLE_ID,
    queries: [Query.lessThan('expires_at', now.toISOString()), Query.orderAsc('expires_at'), Query.limit(100)],
    total: false,
  });
  for (const row of result.rows || []) {
    try {
      await db.deleteRow({ databaseId: DATABASE_ID, tableId: TABLE_ID, rowId: row.$id });
      deleted++;
    } catch (cause) {
      if (Number(cause?.code) !== 404) throw cause;
    }
  }
  return deleted;
}
module.exports = { handleSubmitBugReport, pruneExpiredBugReports, normalizeReport, reportId,
  RETENTION_DAYS, MAX_REPORTS_PER_HOUR };
