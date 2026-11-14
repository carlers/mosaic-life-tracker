// Additive only: isolated synthetic E2EE pilot tables, no legacy Diary changes.
import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
const tableIds = ['private_diary_ciphertexts', 'account_crypto_envelopes'];

export async function migrateE2eeDiaryPilotBackend({
  request, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  const base = '/tablesdb/' + databaseId + '/tables';
  const results = [];
  for (const id of tableIds) {
    const expected = MOSAIC_TABLES.find(t => t.id === id);
    if (!expected || expected.permissions.length !== 0 || expected.rowSecurity !== true) {
      throw new Error('Missing private E2EE pilot manifest: ' + id);
    }
    let existing;
    try { existing = await request('GET', base + '/' + id); }
    catch (e) { if (Number(e?.status) !== 404) throw e; }
    if (!existing) {
      log('Creating isolated ciphertext table ' + id);
      await request('POST', base, {
        tableId: expected.id, name: expected.name, permissions: [],
        rowSecurity: true, enabled: true,
        columns: expected.columns, indexes: expected.indexes,
      });
      results.push({ id, created: true });
      continue;
    }
    const p = existing.$permissions ?? existing.permissions ?? [];
    if (existing.$id !== id || !Array.isArray(p) || p.length !== 0 ||
        existing.rowSecurity !== true || existing.enabled === false) {
      throw new Error('Pilot E2EE table permission drift: ' + id);
    }
    const actualColumns = new Map((existing.columns || []).map(c => [c.key, c]));
    for (const field of expected.columns) {
      const actual = actualColumns.get(field.key);
      if (!actual || actual.type !== field.type ||
          actual.required !== field.required ||
          (field.size && actual.size !== field.size)) {
        throw new Error('Pilot E2EE column drift: ' + id + '/' + field.key);
      }
    }
    const actualIndexes = new Map((existing.indexes || []).map(i => [i.key, i]));
    for (const index of expected.indexes) {
      const actual = actualIndexes.get(index.key);
      if (!actual || actual.type !== index.type ||
          JSON.stringify(actual.attributes ?? actual.columns) !== JSON.stringify(index.attributes)) {
        throw new Error('Pilot E2EE index drift: ' + id + '/' + index.key);
      }
    }
    results.push({ id, created: false });
  }
  return results;
}
