'use strict';

// Scratch-only groundwork for a future atomic reference/deletion protocol.
// NOT wired to runtime until direct writes and legacy paths are migrated.
const { referencedIds } = require('./owner-media-reference-guard');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const LEDGER = 'media_uploads';

async function stageReferenceTransaction(db, { callerId, tableId, data, previousData, stageTarget }) {
  if (typeof callerId !== 'string' || !callerId ||
      typeof stageTarget !== 'function') throw Error('Invalid reference transaction');
  const nextIds = new Set(referencedIds(tableId, data));
  const priorIds = referencedIds(tableId, previousData);
  const fileIds = [...new Set([...nextIds, ...priorIds])];
  if (!fileIds.length) return { guarded: false };
  const stagedRows = [];
  for (const id of fileIds.sort()) {
    let row;
    try {
      row = await db.getRow({ databaseId: DATABASE_ID, tableId: LEDGER, rowId: id });
    } catch (error) {
      // Legacy file IDs are deliberately not eligible for reclamation.
      if (Number(error?.code) === 404) continue;
      throw error;
    }
    if (row?.file_id !== id || row?.owner_id !== callerId) {
      return { guarded: true, denied: { status: 403, body: { error: 'Media owner mismatch' } } };
    }
    // Tombstoned media must never be reintroduced, but a recovery write that
    // ONLY clears an already-existing stale pointer must remain possible.
    if (nextIds.has(id) && row.status !== 'verified') {
      return { guarded: true, denied: { status: 409, body: { error: 'Media not referenceable' } } };
    }
    if (!Number.isSafeInteger(row.reference_epoch) || row.reference_epoch < 0 ||
        row.reference_epoch === Number.MAX_SAFE_INTEGER)
      throw Error('Media epoch migration incomplete');
    stagedRows.push(row);
  }
  if (!stagedRows.length) return { guarded: false };
  const tx = await db.createTransaction();
  if (!tx?.$id) throw Error('Appwrite transaction unavailable');
  try {
    for (const row of stagedRows) {
      await db.updateRow({
        databaseId: DATABASE_ID, tableId: LEDGER, rowId: row.file_id,
        data: { reference_epoch: row.reference_epoch + 1 },
        transactionId: tx.$id,
      });
    }
    const result = await stageTarget(tx.$id);
    // When the staged target is a filtered CAS update, zero matches must not
    // commit an epoch touch as if a media reference was successfully written.
    if (result && typeof result.total === 'number' && result.total !== 1) {
      throw Object.assign(new Error('Reference write conflict'), { code: 409 });
    }
    await db.updateTransaction({ transactionId: tx.$id, commit: true });
    return { guarded: true, result };
  } catch (error) {
    // Never retry failed staging as an unguarded write.
    try { await db.updateTransaction({ transactionId: tx.$id, rollback: true }); }
    catch { /* Preserve original failure. */ }
    throw error;
  }
}

function enabled() {
  return process.env.MOSAIC_1478_REFERENCE_FENCE_ENABLED === 'true';
}

module.exports = { stageReferenceTransaction, enabled };
