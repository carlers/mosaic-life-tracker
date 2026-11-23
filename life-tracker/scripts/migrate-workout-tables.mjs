import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = ['activities','activity_task_links'].map(id => {
  const table = MOSAIC_TABLES.find(item => item.id === id);
  if (!table) throw new Error('Missing workout table in reviewed manifest: ' + id);
  return table;
});

/**
 * Additive schema-only operation. Only Appwrite Preview, never Scratch or Production.
 * Caller must supply a reviewed, authenticated and separately authorized request
 * client. No arbitrary URL, fallback, mutation of existing rows, or hidden activation.
 */
export async function migrateWorkoutTablesBackend({
  request,
  projectId,
  databaseId = MOSAIC_DATABASE.id,
  log = () => {},
}) {
  if (projectId !== '6ae94a2100014d01f5ed') throw new Error('Workout migration requires the exact Appwrite Preview project');
  if (databaseId !== 'life_tracker') throw new Error('Workout migration database mismatch');
  if (typeof request !== 'function') throw new Error('Missing authenticated Preview transport');

  const base = '/tablesdb/' + databaseId + '/tables';
  const states = [];
  // Preflight every existing table *before* making additive writes.
  for (const wanted of expected) {
    let actual;
    try { actual = await request('GET', base + '/' + wanted.id); }
    catch (err) { if (Number(err?.status) !== 404) throw err; }
    if (!actual) { states.push({ expected: wanted, missing: true }); continue; }
    const permissions = actual.$permissions ?? actual.permissions ?? [];
    if (actual.$id !== wanted.id || actual.rowSecurity !== true || actual.enabled === false ||
        JSON.stringify([...permissions].sort()) !== JSON.stringify([...wanted.permissions].sort())) {
      throw new Error('Workout table permission drift: ' + wanted.id);
    }
    const fields = new Map((actual.columns ?? []).map(col => [col.key, col]));
    for (const col of wanted.columns) {
      const found = fields.get(col.key);
      if (!found || found.type !== col.type || found.required !== col.required ||
          (col.size && found.size !== col.size)) {
        throw new Error('Workout column drift: ' + wanted.id + '.' + col.key);
      }
    }
    const indexes = new Map((actual.indexes ?? []).map(idx => [idx.key, idx]));
    for (const idx of wanted.indexes) {
      const found = indexes.get(idx.key);
      if (!found || found.type !== idx.type ||
          JSON.stringify(found.attributes ?? found.columns) !== JSON.stringify(idx.attributes)) {
        throw new Error('Workout index drift: ' + wanted.id + '.' + idx.key);
      }
    }
    states.push({ expected:wanted, missing:false });
  }
  const created = [];
  for (const entry of states) {
    if (!entry.missing) continue;
    log('Creating owner-private workout table ' + entry.expected.id);
    await request('POST', base, {
      tableId:entry.expected.id, name:entry.expected.name,
      permissions:entry.expected.permissions, rowSecurity:entry.expected.rowSecurity,
      enabled:entry.expected.enabled, columns:entry.expected.columns, indexes:entry.expected.indexes,
    });
    created.push(entry.expected.id);
  }
  return { created, verified: expected.map(item=>item.id) };
}
