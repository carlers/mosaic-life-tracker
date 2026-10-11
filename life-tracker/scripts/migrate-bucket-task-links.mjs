import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
const expected = MOSAIC_TABLES.find(item => item.id === 'bucket_task_links');
export async function migrateBucketTaskLinksBackend({ request, databaseId = MOSAIC_DATABASE.id, log = () => {} }) {
  if (!expected) throw new Error('Bucket task links missing from manifest');
  const base = '/tablesdb/' + databaseId + '/tables';
  let existing;
  try { existing = await request('GET', base + '/bucket_task_links'); }
  catch (error) { if (Number(error?.status) !== 404) throw error; }
  if (!existing) {
    log('Creating private bucket task links');
    await request('POST', base, {
      tableId: expected.id, name: expected.name, permissions: expected.permissions,
      rowSecurity: expected.rowSecurity, enabled: expected.enabled,
      columns: expected.columns, indexes: expected.indexes,
    });
    return { created: true };
  }
  const permissions = existing.$permissions ?? existing.permissions ?? [];
  if (existing.$id !== expected.id || !existing.rowSecurity || existing.enabled === false ||
      JSON.stringify([...permissions].sort()) !== JSON.stringify([...expected.permissions].sort())) {
    throw new Error('Bucket task links permission drift');
  }
  const fields = new Map((existing.columns ?? []).map(col => [col.key, col]));
  for (const field of expected.columns) {
    const actual = fields.get(field.key);
    if (!actual || actual.type !== field.type || actual.required !== field.required ||
        (field.size && actual.size !== field.size) ||
        (Object.hasOwn(field, 'default') && actual.default !== field.default)) throw new Error('Bucket task links column drift: ' + field.key);
  }
  const indexes = new Map((existing.indexes ?? []).map(index => [index.key, index]));
  for (const index of expected.indexes) {
    const actual = indexes.get(index.key);
    if (!actual || actual.type !== index.type ||
        JSON.stringify(actual.attributes ?? actual.columns) !== JSON.stringify(index.attributes)) throw new Error('Bucket task links index drift: ' + index.key);
  }
  return { created: false };
}
