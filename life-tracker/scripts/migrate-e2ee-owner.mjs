/**
 * Additive, server-only ciphertext tables for #1662 M2.
 *
 * Opt-in exact disposable Oracle Scratch project ONLY. Existing plaintext
 * TablesDB data and Storage permissions are not modified here. A later
 * independently verified cutover must retire old writers atomically.
 */
import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const exactScratch = '6ae94a2100014d01f5ed';
export const OWNER_CIPHERTEXT_TABLE_IDS = [
  'private_owner_ciphertexts_v1', 'account_crypto_roots_v2',
];

export async function migrateE2eeOwnerBackend({
  request, projectId, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  if (projectId !== exactScratch) {
    throw new Error('E2EE owner migration may run only on the exact disposable Oracle Scratch project');
  }
  if (typeof request !== 'function') throw new Error('Missing managed-state request');
  const base = '/tablesdb/' + databaseId + '/tables';
  const results = [];
  for (const id of OWNER_CIPHERTEXT_TABLE_IDS) {
    const expected = MOSAIC_TABLES.find(t => t.id === id);
    if (!expected || expected.rowSecurity !== true ||
        expected.permissions.length !== 0) {
      throw new Error('Missing secured E2EE owner table manifest: ' + id);
    }
    let actual;
    let created = false;
    try { actual = await request('GET', base + '/' + id); }
    catch (e) {
      if (Number(e?.status) !== 404) throw e;
    }
    if (!actual) {
      // The migration API owns additive table construction; this must not
      // be called during ordinary app startup or default migration batches.
      await request('POST', base, {
        tableId: expected.id, name: expected.name, permissions: [],
        rowSecurity: true, enabled: true,
        columns: expected.columns, indexes: expected.indexes,
      });
      created = true;
      // A create response (or broker acceptance) does not prove the table is
      // safe for user ciphertext. Read back the full managed ACL and schema,
      // fail closed if incomplete, and leave the partial table for recovery.
      try { actual = await request('GET', base + '/' + id); }
      catch { throw new Error('E2EE owner table post-create readback unavailable: ' + id); }
    }
    const actualPermissions = actual?.$permissions ?? actual?.permissions;
    // A connector that omits ACL/enablement fields cannot prove browser deny.
    if (actual?.$id !== id || !Array.isArray(actualPermissions) ||
        actualPermissions.length !== 0 || actual.rowSecurity !== true ||
        actual.enabled !== true) {
      throw new Error('E2EE owner table access drift: ' + id);
    }
    const columns = new Map((actual.columns || []).map(v => [v.key, v]));
    if (columns.size !== expected.columns.length) {
      throw new Error('E2EE owner table column-count drift: ' + id);
    }
    for (const column of expected.columns) {
      const received = columns.get(column.key);
      if (!received || received.type !== column.type ||
          received.required !== column.required ||
          (column.size && received.size !== column.size)) {
        throw new Error('E2EE owner table column drift: ' + id + '/' + column.key);
      }
    }
    const indexes = new Map((actual.indexes || []).map(v => [v.key, v]));
    if (indexes.size !== expected.indexes.length) {
      throw new Error('E2EE owner table index-count drift: ' + id);
    }
    for (const index of expected.indexes) {
      const received = indexes.get(index.key);
      if (!received || received.type !== index.type ||
          JSON.stringify(received.attributes ?? received.columns) !==
            JSON.stringify(index.attributes)) {
        throw new Error('E2EE owner table index drift: ' + id + '/' + index.key);
      }
    }
    if (created) log('Created and verified opt-in encrypted owner table ' + id);
    results.push({ id, created });
  }
  return results;
}
