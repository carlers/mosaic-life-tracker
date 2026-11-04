'use strict';

// Defense in depth for Function-mediated writes. NOT an atomic cross-device
// fence; historical direct TablesDB permissions can still bypass this check.
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const PATTERN = /img_[0-9a-f]{32}/g;
const FIELDS = { tasks: ['image'], diary: ['photos'], settings: ['value'] };
const DENIED = new Set(['pending_delete', 'deleting', 'deleted']);

function referencedIds(tableId, data) {
  const found = new Set();
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  for (const field of FIELDS[tableId] || []) {
    if (typeof data[field] === 'string') {
      for (const m of data[field].matchAll(PATTERN)) found.add(m[0]);
    }
  }
  return [...found];
}

async function guardOwnerMediaReferences(db, callerId, tableId, data) {
  for (const id of referencedIds(tableId, data)) {
    let row;
    try {
      row = await db.getRow({ databaseId: DATABASE_ID, tableId: 'media_uploads', rowId: id });
    } catch (error) {
      // Preserve unknown legacy files, which are never reclaimable.
      if (Number(error?.code) === 404) continue;
      throw error;
    }
    if (row?.file_id !== id || row?.owner_id !== callerId)
      return { status: 403, body: { error: 'Media owner mismatch' } };
    if (DENIED.has(row.status))
      return { status: 409, body: { error: 'Media is pending deletion or deleted' } };
    if (!['reserved','verified'].includes(row.status))
      return { status: 409, body: { error: 'Media state unavailable' } };
  }
  return null;
}
module.exports = { referencedIds, guardOwnerMediaReferences };
