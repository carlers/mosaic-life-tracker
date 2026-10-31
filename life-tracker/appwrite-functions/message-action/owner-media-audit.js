'use strict';

// Read-only server audit for Phase 3B. This never authorizes deletion.
// It inventories referenced task/Diary/profile media and counts only files
// with unambiguous user-specific update+delete grants as ACL-controlled.
// A grant is NOT a durable ownership/provenance record.
const { Query } = require('node-appwrite');
const { ownerReferenceIndex, assessMediaLifecycle } = require('./media-lifecycle');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const PAGE_SIZE = 100;
const MAX_ROW_PAGES_PER_TABLE = 10;
const MAX_BUCKET_PAGES = 10;
const TABLES = ['tasks', 'diary', 'settings'];
const FILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
function validFileId(id) {
  return typeof id === 'string' && FILE_ID.test(id) &&
    !id.startsWith('localimg_');
}

function soleOwnerControl(permissions, ownerId) {
  if (!Array.isArray(permissions)) return false;
  const requiredUpdate = 'update("user:' + ownerId + '")';
  const requiredDelete = 'delete("user:' + ownerId + '")';
  return permissions.includes(requiredUpdate) &&
    permissions.includes(requiredDelete) &&
    !permissions.some((p) => typeof p !== 'string' ||
      (/^(update|delete|write)\(/.test(p) &&
        p !== requiredUpdate && p !== requiredDelete));
}

async function paginate(fetchPage, cap) {
  const items = [];
  let cursor = null;
  for (let page = 0; page < cap; page++) {
    const result = await fetchPage(cursor);
    if (!Array.isArray(result)) throw new Error('Invalid pagination response');
    if (result.length > PAGE_SIZE) throw new Error('Unexpected page size');
    items.push(...result);
    if (result.length < PAGE_SIZE) return { items, truncated: false };
    const next = result.at(-1)?.$id;
    if (typeof next !== 'string' || !next || next === cursor) {
      throw new Error('Media inventory pagination stalled');
    }
    cursor = next;
  }
  // A page exactly filling the cap may be the final page. Fail closed.
  return { items, truncated: true };
}

async function ownerRows(db, table, ownerId) {
  return paginate(async (cursor) => {
    const response = await db.listRows({
      databaseId: DATABASE_ID,
      tableId: table,
      queries: [
        Query.equal('user_id', ownerId),
        Query.orderAsc('$id'),
        Query.limit(PAGE_SIZE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    return (response || {}).rows;
  }, MAX_ROW_PAGES_PER_TABLE);
}

async function bucketFiles(storage) {
  return paginate(async (cursor) => {
    const response = await storage.listFiles({
      bucketId: BUCKET_ID,
      queries: [
        Query.orderAsc('$id'),
        Query.limit(PAGE_SIZE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    return (response || {}).files;
  }, MAX_BUCKET_PAGES);
}

function flattenedOwnerRow(row, ownerId) {
  if (!row || typeof row !== 'object') throw new Error('Malformed owner row');
  // Support the REST response with nested data and the SDK flattened format.
  const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ?
    row.data : row;
  if (data.user_id !== ownerId) throw new Error('Untrusted media row ownership');
  return data;
}

function emptyCount() { return { files: 0, bytes: 0 }; }
function addCount(count, file) {
  count.files += 1;
  count.bytes += file.sizeOriginal;
}

async function auditOwnerMedia({ db, storage, callerId, requestedOwnerId }) {
  if (typeof callerId !== 'string' || !callerId) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }
  if (requestedOwnerId !== undefined && requestedOwnerId !== callerId) {
    return { status: 403, body: { error: 'Forbidden' } };
  }

  const tables = {};
  let rowsTruncated = false;
  for (const table of TABLES) {
    const page = await ownerRows(db, table, callerId);
    tables[table] = page.items.map((row) => flattenedOwnerRow(row, callerId));
    rowsTruncated ||= page.truncated;
  }
  const index = ownerReferenceIndex(callerId, tables);
  const bucket = await bucketFiles(storage);
  const controls = new Map();
  let invalidMetadata = 0;
  for (const file of bucket.items) {
    if (!file || !soleOwnerControl(file.$permissions, callerId)) continue;
    // Fail closed on invalid IDs, even when the ACL appears owner-controlled.
    // These must never be presented as usable or reclaimable storage.
    if (!validFileId(file.$id)) {
      invalidMetadata++;
      continue;
    }
    // Duplicate IDs or inconsistent metadata cannot be verified.
    if (controls.has(file.$id)) throw new Error('Duplicate storage metadata');
    controls.set(file.$id, file);
  }

  const refsById = new Map();
  for (const ref of index.references) {
    if (!refsById.has(ref.fileId)) refsById.set(ref.fileId, []);
    refsById.get(ref.fileId).push(ref);
  }

  const live = emptyCount();
  const pendingRemoval = emptyCount();
  const unreferencedUnverified = emptyCount();
  let missingOrUnverifiedReferences = 0;
  const noProvenance = { authoritative: false };
  const noCoverage = {}; // No authoritative upload ledger or old-client fence.
  for (const [fileId, refs] of refsById) {
    const file = controls.get(fileId);
    if (!file) {
      missingOrUnverifiedReferences++;
      continue;
    }
    if (!Number.isSafeInteger(file.sizeOriginal) || file.sizeOriginal < 0) {
      invalidMetadata++;
      continue;
    }
    const lifecycle = assessMediaLifecycle({
      ownerId: callerId,
      fileId,
      index,
      file,
      provenance: noProvenance,
      coverage: noCoverage,
    });
    if (lifecycle.state === 'live-referenced') addCount(live, file);
    else if (lifecycle.state === 'pending-removal') addCount(pendingRemoval, file);
    else invalidMetadata++;
    if (refs.length === 0) throw new Error('Missing reference index');
  }

  for (const [fileId, file] of controls) {
    if (refsById.has(fileId)) continue;
    if (!Number.isSafeInteger(file.sizeOriginal) || file.sizeOriginal < 0) {
      invalidMetadata++;
      continue;
    }
    // This is not an orphan classification; old PWAs, other-owner refs,
    // failed uploads and a missing provenance ledger remain unresolved.
    addCount(unreferencedUnverified, file);
  }

  const truncated = rowsTruncated || bucket.truncated;
  return {
    status: 200,
    body: {
      coverage: 'partial-acl-and-owner-references',
      deletionAuthorized: false,
      checkedAt: new Date().toISOString(),
      truncated,
      complete: false,
      // These are NOT billed usage, reclaimable bytes or proof of ownership.
      aclControlledReferencedLive: live,
      aclControlledTombstoned: pendingRemoval,
      aclControlledUnreferencedUnknown: unreferencedUnverified,
      missingOrUnverifiedReferences,
      unclassifiedRecords: index.malformed,
      pendingLocalImageIds: index.pendingUploads,
      invalidMetadata,
      limitations: [
        'no-authoritative-upload-provenance',
        'no-cross-owner-reference-proof',
        'no-old-client-or-pending-write-fence',
        ...(truncated ? ['pagination-truncated'] : []),
      ],
    },
  };
}

module.exports = {
  auditOwnerMedia,
  ownerRows,
  bucketFiles,
  soleOwnerControl,
  PAGE_SIZE,
  MAX_ROW_PAGES_PER_TABLE,
  MAX_BUCKET_PAGES,
};
