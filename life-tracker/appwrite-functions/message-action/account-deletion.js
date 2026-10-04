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

async function readRow(db, tableId, rowId, transactionId) {
  try {
    return await db.getRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      ...(transactionId ? { transactionId } : {}),
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function listProfilesByUserId(db, userId) {
  return listAllRows(db, 'profiles', [Query.equal('user_id', userId)]);
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
    await mapLimit(rows, DELETE_CONCURRENCY, async (row) => {
      try {
        await db.deleteRow({
          databaseId: DATABASE_ID,
          tableId,
          rowId: row.$id,
        });
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    });
    deleted += rows.length;
    if (rows.length < PAGE_SIZE) return deleted;
  }
  throw new Error('Account deletion exceeded delete page limit for ' + tableId);
}

function parseReactionArray(raw) {
  if (!raw) return { valid: true, reactions: [] };
  if (typeof raw !== 'string') return { valid: false, reactions: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { valid: false, reactions: [] };
    let valid = true;
    const reactions = [];
    for (const value of parsed) {
      if (
        !value ||
        typeof value !== 'object' ||
        typeof value.emoji !== 'string' ||
        !Array.isArray(value.userIds) ||
        value.userIds.some((id) => typeof id !== 'string')
      ) {
        valid = false;
        continue;
      }
      reactions.push({ emoji: value.emoji, userIds: [...value.userIds] });
    }
    return { valid, reactions };
  } catch {
    return { valid: false, reactions: [] };
  }
}

function stripUserFromReactions(raw, userId) {
  const parsed = parseReactionArray(raw);
  if (!parsed.valid && typeof raw === 'string' && raw.includes(userId)) {
    return { changed: true, value: '' };
  }

  let changed = false;
  const next = [];
  for (const reaction of parsed.reactions) {
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
      return { changed: raw.includes(userId), value: '' };
    }
    for (const key of ['order', 'hidden']) {
      if (
        parsed[key] !== undefined &&
        (!Array.isArray(parsed[key]) ||
          parsed[key].some((id) => typeof id !== 'string'))
      ) {
        return { changed: raw.includes(userId), value: '' };
      }
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
    return { changed: raw.includes(userId), value: '' };
  }
}

async function scrubRowWithTransaction(
  db,
  tableId,
  rowId,
  userId,
  transform
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await db.createTransaction({ ttl: 60 });
    let committed = false;
    try {
      const current = await readRow(db, tableId, rowId, tx.$id);
      if (!current) return false;

      const next = transform(current, userId);
      if (!next.changed) return false;

      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        data: next.data,
        transactionId: tx.$id,
      });
      await db.updateTransaction({
        transactionId: tx.$id,
        commit: true,
      });
      committed = true;
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      if (Number(error && error.code) === 409 && attempt < 2) continue;
      throw error;
    } finally {
      if (!committed) {
        await db.updateTransaction({
          transactionId: tx.$id,
          rollback: true,
        }).catch(() => {});
      }
    }
  }
  return false;
}

async function scrubCrossUserReferences(db, userId) {
  let scrubbed = 0;
  const tasks = await listAllRows(db, 'tasks');
  for (const row of tasks) {
    if (row.user_id === userId) continue;
    const changed = await scrubRowWithTransaction(
      db,
      'tasks',
      row.$id,
      userId,
      (current, deletingUserId) => {
        const next = stripUserFromReactions(
          current.reactions,
          deletingUserId
        );
        return {
          changed: next.changed,
          data: {
            reactions: next.value,
            updated_at: new Date().toISOString(),
          },
        };
      }
    );
    if (changed) scrubbed += 1;
  }

  const settings = await listAllRows(db, 'settings');
  for (const row of settings) {
    if (row.user_id === userId || row.key !== 'friend_carousel_prefs') continue;
    const changed = await scrubRowWithTransaction(
      db,
      'settings',
      row.$id,
      userId,
      (current, deletingUserId) => {
        if (current.key !== 'friend_carousel_prefs') {
          return { changed: false, data: {} };
        }
        const next = stripFriendCarouselValue(
          current.value,
          deletingUserId
        );
        return {
          changed: next.changed,
          data: {
            value: next.value,
            updated_at: new Date().toISOString(),
          },
        };
      }
    );
    if (changed) scrubbed += 1;
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
  try {
    return await db.updateRow({
      databaseId: DATABASE_ID,
      tableId: JOBS_TABLE,
      rowId: jobId,
      data: { ...data, updated_at: new Date().toISOString() },
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
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
        status: 'preparing',
        phase: 'dr_marker',
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
  const profiles = await listProfilesByUserId(db, userId);
  for (const profile of profiles) {
    try {
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
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
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

  const profiles = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: 'profiles',
    queries: [Query.equal('user_id', userId), Query.limit(1)],
    total: false,
  });
  if ((profiles.rows || []).length > 0) {
    throw new Error('Profile row remains');
  }

  for (const row of await listAllRows(db, 'tasks')) {
    const parsed = parseReactionArray(row.reactions);
    if (
      (!parsed.valid &&
        typeof row.reactions === 'string' &&
        row.reactions.includes(userId)) ||
      parsed.reactions.some((r) => r.userIds.includes(userId))
    ) {
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

async function cleanupDeletionData({ db, storage, userId }) {
  await hideProfile(db, userId);

  for (const tableId of OWNED_TABLES) {
    await hardDeleteByQuery(db, tableId, [Query.equal('user_id', userId)]);
  }
  for (const [tableId, fields] of Object.entries(CROSS_REFERENCE_QUERIES)) {
    for (const field of fields) {
      await hardDeleteByQuery(db, tableId, [Query.equal(field, userId)]);
    }
  }

  await hardDeleteByQuery(db, 'profiles', [Query.equal('user_id', userId)]);
  await scrubCrossUserReferences(db, userId);
  await deleteOwnedFiles(storage, userId);
}

async function processDeletionJob({
  db,
  storage,
  users,
  functions,
  jobId,
  log = () => {},
}) {
  const job = await readRow(db, JOBS_TABLE, jobId);
  if (!job) return { ok: true, missing: true };
  const userId = job.user_id;
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Invalid deletion job owner');
  }

  await updateJob(db, jobId, {
    status: job.status === 'preparing' ? 'preparing' : 'running',
    phase: 'dr_marker',
    attempts: Number(job.attempts || 0) + 1,
  });

  // This confirmed, immutable DR marker is the privacy pivot. No destructive
  // Appwrite work may run before it succeeds.
  await invokePrivacyMarker(functions, userId);
  await updateJob(db, jobId, {
    status: 'running',
    phase: 'freeze',
  });

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
  await cleanupDeletionData({ db, storage, userId });

  // A second pass after the Auth/session fence catches writes/uploads that
  // were already in flight when the freeze began. Trusted Function writes
  // are also blocked by the durable deletion-job fence in main.js.
  await updateJob(db, jobId, { phase: 'reconcile' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await cleanupDeletionData({ db, storage, userId });

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

  try {
    await db.deleteRow({
      databaseId: DATABASE_ID,
      tableId: JOBS_TABLE,
      rowId: jobId,
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

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
    return {
      status: 400,
      body: { error: 'Type DELETE to confirm account deletion.' },
    };
  }

  const job = await ensureDeletionJob(db, callerId);
  const jobId = job.$id || deletionJobId(callerId);

  let markerReady = false;
  try {
    await invokePrivacyMarker(functions, callerId);
    markerReady = true;
    await updateJob(db, jobId, {
      status: 'pending',
      phase: 'marker_ready',
    });
  } catch {
    await updateJob(db, jobId, {
      status: 'preparing',
      phase: 'dr_marker_retry',
    }).catch(() => {});
    log('account-deletion: privacy pivot pending');
  }

  if (markerReady) {
    try {
      await hideProfile(db, callerId);
      await users.updateStatus({ userId: callerId, status: false });
      await users.deleteSessions({ userId: callerId });
      await updateJob(db, jobId, {
        status: 'pending',
        phase: 'queued',
      });
    } catch {
      await updateJob(db, jobId, {
        status: 'pending',
        phase: 'accepted_retry',
      }).catch(() => {});
      log('account-deletion: accepted; freeze deferred to worker');
    }
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
      status: markerReady ? 'pending' : 'preparing',
      phase: markerReady ? 'queued_schedule' : 'dr_marker_schedule',
    }).catch(() => {});
    log('account-deletion: async kick unavailable; scheduled retry retained');
  }

  return {
    status: 202,
    body: {
      ok: true,
      accepted: markerReady,
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
    if (
      job.status !== 'preparing' &&
      job.status !== 'pending' &&
      job.status !== 'running'
    ) continue;
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
        status: job.status === 'preparing' ? 'preparing' : 'pending',
        phase: job.status === 'preparing' ? 'dr_marker_retry' : 'retry',
      }).catch(() => {});
      log('account-deletion: job deferred for retry');
    }
  }
  return { processed, failed };
}

async function isAccountDeletionPending(db, userId) {
  if (typeof userId !== 'string' || !userId) return false;
  return Boolean(await readRow(db, JOBS_TABLE, deletionJobId(userId)));
}

module.exports = {
  CROSS_REFERENCE_QUERIES,
  OWNED_TABLES,
  deleteOwnedFiles,
  deletionJobId,
  ensureDeletionJob,
  hardDeleteByQuery,
  isAccountDeletionPending,
  permissionsBelongToUser,
  processDeletionJob,
  resumeDeletionJobs,
  scrubCrossUserReferences,
  startAccountDeletion,
  stripFriendCarouselValue,
  stripUserFromReactions,
  verifyNoLiveTrace,
};
