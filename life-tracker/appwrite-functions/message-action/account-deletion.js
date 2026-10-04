const crypto = require('crypto');
const { Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const JOBS_TABLE = process.env.APPWRITE_TABLE_ACCOUNT_DELETIONS || 'account_deletions';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const DR_FUNCTION_ID = process.env.DR_BACKUP_FUNCTION_ID || 'dr_backup';
const DR_REQUIRED = process.env.DR_PRIVACY_DELETION_REQUIRED !== 'false';
const PAGE_SIZE = 100;
const MAX_PAGES = 1000;
const DELETE_CONCURRENCY = 8;

const OWNED_TABLES = ['tasks', 'categories', 'diary', 'settings'];
const CROSS_REFERENCE_QUERIES = {
  friendships: ['user_id', 'friend_id'],
  messages: ['user_id', 'sender_id', 'recipient_id'],
};

function deletionJobId(userId) {
  return 'del_' + crypto.createHash('sha256').update(userId).digest('hex').slice(0, 32);
}

function isNotFound(error) {
  return Number(error && error.code) === 404;
}

async function readRow(db, tableId, rowId) {
  try {
    return await db.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function findProfileByUserId(db, userId) {
  const result = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: 'profiles',
    queries: [Query.equal('user_id', userId), Query.limit(2)],
    total: false,
  });
  const rows = result.rows || [];
  if (rows.length > 1) {
    throw new Error('Account deletion found duplicate profile owners');
  }
  return rows[0] || null;
}

async function mapLimit(values, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      await worker(values[index], index);
    }
  });
  await Promise.all(workers);
}

async function listAllRows(db, tableId, baseQueries = []) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [
        ...baseQueries,
        Query.limit(PAGE_SIZE),
        Query.orderAsc('$id'),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    const pageRows = result.rows || [];
    if (pageRows.length === 0) return rows;
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
    const next = pageRows.at(-1)?.$id;
    if (!next || next === cursor) {
      throw new Error('Account deletion pagination stalled for ' + tableId);
    }
    cursor = next;
  }
  throw new Error('Account deletion exceeded page limit for ' + tableId);
}

async function hardDeleteByQuery(db, tableId, queries) {
  let deleted = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [...queries, Query.limit(PAGE_SIZE), Query.orderAsc('$id')],
      total: false,
    });
    const rows = result.rows || [];
    if (rows.length === 0) return deleted;
    await mapLimit(rows, DELETE_CONCURRENCY, (row) =>
      db.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id })
    );
    deleted += rows.length;
    if (rows.length < PAGE_SIZE) return deleted;
  }
  throw new Error('Account deletion exceeded delete page limit for ' + tableId);
}

function parseReactionArray(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value) => value && typeof value === 'object' && typeof value.emoji === 'string' && Array.isArray(value.userIds))
      .map((value) => ({
        emoji: value.emoji,
        userIds: value.userIds.filter((id) => typeof id === 'string'),
      }));
  } catch {
    return [];
  }
}

function stripUserFromReactions(raw, userId) {
  const parsed = parseReactionArray(raw);
  let changed = false;
  const next = [];
  for (const reaction of parsed) {
    const ids = reaction.userIds.filter((id) => id !== userId);
    if (ids.length !== reaction.userIds.length) changed = true;
    if (ids.length > 0) next.push({ emoji: reaction.emoji, userIds: ids });
  }
  return {
    changed,
    value: next.length > 0 ? JSON.stringify(next) : '',
  };
}

function stripFriendCarouselValue(raw, userId) {
  if (typeof raw !== 'string' || !raw) return { changed: false, value: raw };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { changed: false, value: raw };
    }
    let changed = false;
    const next = { ...parsed };
    for (const key of ['order', 'hidden']) {
      if (!Array.isArray(parsed[key])) continue;
      const values = parsed[key].filter((id) => id !== userId);
      if (values.length !== parsed[key].length) changed = true;
      next[key] = values;
    }
    return { changed, value: changed ? JSON.stringify(next) : raw };
  } catch {
    return { changed: false, value: raw };
  }
}

async function scrubCrossUserReferences(db, userId) {
  let scrubbed = 0;
  const tasks = await listAllRows(db, 'tasks');
  for (const row of tasks) {
    if (row.user_id === userId) continue;
    const next = stripUserFromReactions(row.reactions, userId);
    if (!next.changed) continue;
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId: 'tasks',
      rowId: row.$id,
      data: { reactions: next.value, updated_at: new Date().toISOString() },
    });
    scrubbed += 1;
  }

  const settings = await listAllRows(db, 'settings');
  for (const row of settings) {
    if (row.user_id === userId || row.key !== 'friend_carousel_prefs') continue;
    const next = stripFriendCarouselValue(row.value, userId);
    if (!next.changed) continue;
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId: 'settings',
      rowId: row.$id,
      data: { value: next.value, updated_at: new Date().toISOString() },
    });
    scrubbed += 1;
  }
  return scrubbed;
}

function permissionsBelongToUser(permissions, userId) {
  if (!Array.isArray(permissions)) return false;
  const owner = 'user:' + userId;
  return permissions.some((permission) =>
    permission === 'update("' + owner + '")' ||
    permission === 'delete("' + owner + '")'
  );
}

async function listOwnedFileIds(storage, userId) {
  const ids = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await storage.listFiles({
      bucketId: BUCKET_ID,
      queries: [
        Query.limit(PAGE_SIZE),
        Query.orderAsc('$id'),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    const files = result.files || [];
    for (const file of files) {
      if (permissionsBelongToUser(file.$permissions, userId)) ids.push(file.$id);
    }
    if (files.length < PAGE_SIZE) return ids;
    const next = files.at(-1)?.$id;
    if (!next || next === cursor) throw new Error('Account deletion storage pagination stalled');
    cursor = next;
  }
  throw new Error('Account deletion exceeded storage page limit');
}

async function deleteOwnedFiles(storage, userId) {
  const ids = await listOwnedFileIds(storage, userId);
  await mapLimit(ids, DELETE_CONCURRENCY, async (fileId) => {
    try {
      await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  });
  return ids.length;
}

async function updateJob(db, jobId, data) {
  return db.updateRow({
    databaseId: DATABASE_ID,
    tableId: JOBS_TABLE,
    rowId: jobId,
    data: { ...data, updated_at: new Date().toISOString() },
  });
}

async function ensureDeletionJob(db, userId) {
  const jobId = deletionJobId(userId);
  const existing = await readRow(db, JOBS_TABLE, jobId);
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    return await db.createRow({
      databaseId: DATABASE_ID,
      tableId: JOBS_TABLE,
      rowId: jobId,
      data: {
        user_id: userId,
        status: 'pending',
        phase: 'accepted',
        attempts: 0,
        created_at: now,
        updated_at: now,
      },
      permissions: [],
    });
  } catch (error) {
    if (Number(error && error.code) !== 409) throw error;
    const raced = await readRow(db, JOBS_TABLE, jobId);
    if (!raced) throw error;
    return raced;
  }
}

async function hideProfile(db, userId) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) return;
  await db.updateRow({
    databaseId: DATABASE_ID,
    tableId: 'profiles',
    rowId: profile.$id,
    data: {
      deleted: true,
      is_searchable: false,
      updated_at: new Date().toISOString(),
    },
  });
}

async function invokePrivacyMarker(functions, userId) {
  if (!DR_REQUIRED) return;
  const execution = await functions.createExecution({
    functionId: DR_FUNCTION_ID,
    body: JSON.stringify({ action: 'record_privacy_deletion', userId }),
    async: false,
    xpath: '/',
    method: 'POST',
  });
  if (
    execution.status !== 'completed' ||
    Number(execution.responseStatusCode || 0) >= 400
  ) {
    throw new Error('Could not persist disaster-recovery deletion marker');
  }
  let body = {};
  try { body = JSON.parse(execution.responseBody || '{}'); } catch {}
  if (body.ok !== true) throw new Error('Disaster-recovery deletion marker was not confirmed');
}

async function verifyNoLiveTrace({ db, storage, userId }) {
  for (const tableId of OWNED_TABLES) {
    const result = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.equal('user_id', userId), Query.limit(1)],
      total: false,
    });
    if ((result.rows || []).length > 0) throw new Error('Owned rows remain in ' + tableId);
  }

  for (const [tableId, fields] of Object.entries(CROSS_REFERENCE_QUERIES)) {
    for (const field of fields) {
      const result = await db.listRows({
        databaseId: DATABASE_ID,
        tableId,
        queries: [Query.equal(field, userId), Query.limit(1)],
        total: false,
      });
      if ((result.rows || []).length > 0) {
        throw new Error('Cross-user rows remain in ' + tableId);
      }
    }
  }

  if (await findProfileByUserId(db, userId)) {
    throw new Error('Profile row remains');
  }

  for (const row of await listAllRows(db, 'tasks')) {
    if (parseReactionArray(row.reactions).some((r) => r.userIds.includes(userId))) {
      throw new Error('Task reaction reference remains');
    }
  }
  for (const row of await listAllRows(db, 'settings')) {
    if (row.key !== 'friend_carousel_prefs') continue;
    const raw = typeof row.value === 'string' ? row.value : '';
    if (stripFriendCarouselValue(raw, userId).changed) {
      throw new Error('Friend carousel reference remains');
    }
  }
  if ((await listOwnedFileIds(storage, userId)).length > 0) {
    throw new Error('Owned storage files remain');
  }
}

async function processDeletionJob({ db, storage, users, functions, jobId, log = () => {} }) {
  const job = await readRow(db, JOBS_TABLE, jobId);
  if (!job) return { ok: true, missing: true };
  const userId = job.user_id;
  if (typeof userId !== 'string' || !userId) throw new Error('Invalid deletion job owner');

  await updateJob(db, jobId, {
    status: 'running',
    phase: 'dr_marker',
    attempts: Number(job.attempts || 0) + 1,
  });
  await invokePrivacyMarker(functions, userId);

  await updateJob(db, jobId, { phase: 'freeze' });
  try {
    await users.updateStatus({ userId, status: false });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  try {
    await users.deleteSessions({ userId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  await updateJob(db, jobId, { phase: 'cleanup' });
  await hideProfile(db, userId);

  for (const tableId of OWNED_TABLES) {
    await hardDeleteByQuery(db, tableId, [Query.equal('user_id', userId)]);
  }
  for (const [tableId, fields] of Object.entries(CROSS_REFERENCE_QUERIES)) {
    for (const field of fields) {
      await hardDeleteByQuery(db, tableId, [Query.equal(field, userId)]);
    }
  }

  const profile = await findProfileByUserId(db, userId);
  if (profile) {
    await db.deleteRow({
      databaseId: DATABASE_ID,
      tableId: 'profiles',
      rowId: profile.$id,
    });
  }

  await scrubCrossUserReferences(db, userId);
  await deleteOwnedFiles(storage, userId);

  await updateJob(db, jobId, { phase: 'verify' });
  await verifyNoLiveTrace({ db, storage, userId });

  await updateJob(db, jobId, { phase: 'auth_delete' });
  try {
    await users.deleteSessions({ userId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  try {
    await users.delete({ userId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: JOBS_TABLE,
    rowId: jobId,
  });
  log('account-deletion: completed');
  return { ok: true };
}

async function startAccountDeletion({
  db,
  users,
  functions,
  callerId,
  payload,
  functionId,
  log = () => {},
}) {
  if (payload?.confirmation !== 'DELETE') {
    return { status: 400, body: { error: 'Type DELETE to confirm account deletion.' } };
  }

  const job = await ensureDeletionJob(db, callerId);
  const jobId = job.$id || deletionJobId(callerId);

  // The durable server-owned job is the acceptance boundary. After this row
  // exists, every later failure is retried server-side and must never turn
  // into an ambiguous "not accepted" response.
  try {
    await invokePrivacyMarker(functions, callerId);
    await updateJob(db, jobId, { status: 'pending', phase: 'marker_ready' });
  } catch {
    await updateJob(db, jobId, {
      status: 'pending',
      phase: 'dr_marker_retry',
    }).catch(() => {});
    log('account-deletion: DR marker deferred to worker');
  }

  try {
    await hideProfile(db, callerId);
    await users.updateStatus({ userId: callerId, status: false });
    await users.deleteSessions({ userId: callerId });
    await updateJob(db, jobId, { status: 'pending', phase: 'queued' });
  } catch {
    await updateJob(db, jobId, {
      status: 'pending',
      phase: 'accepted_retry',
    }).catch(() => {});
    log('account-deletion: accepted; freeze deferred to worker');
  }

  try {
    await functions.createExecution({
      functionId,
      body: JSON.stringify({ action: 'resume_account_deletion', jobId }),
      async: true,
      xpath: '/',
      method: 'POST',
    });
  } catch {
    await updateJob(db, jobId, {
      status: 'pending',
      phase: 'queued_schedule',
    }).catch(() => {});
    log('account-deletion: async kick unavailable; scheduled retry retained');
  }

  return {
    status: 202,
    body: {
      ok: true,
      accepted: true,
      deletionPending: true,
    },
  };
}

async function resumeDeletionJobs({ db, storage, users, functions, log = () => {}, jobId }) {
  if (jobId) {
    await processDeletionJob({ db, storage, users, functions, jobId, log });
    return { processed: 1 };
  }

  const jobs = await listAllRows(db, JOBS_TABLE);
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    if (job.status !== 'pending' && job.status !== 'running') continue;
    try {
      await processDeletionJob({
        db,
        storage,
        users,
        functions,
        jobId: job.$id,
        log,
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      await updateJob(db, job.$id, {
        status: 'pending',
        phase: 'retry',
      }).catch(() => {});
      log('account-deletion: job deferred for retry');
    }
  }
  return { processed, failed };
}

module.exports = {
  deleteOwnedFiles,
  deletionJobId,
  ensureDeletionJob,
  hardDeleteByQuery,
  permissionsBelongToUser,
  processDeletionJob,
  resumeDeletionJobs,
  scrubCrossUserReferences,
  startAccountDeletion,
  stripFriendCarouselValue,
  stripUserFromReactions,
  verifyNoLiveTrace,
};
