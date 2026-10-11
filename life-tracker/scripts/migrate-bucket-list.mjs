import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
const expected = MOSAIC_TABLES.find(item => item.id === 'bucket_list_items');
export async function migrateBucketListBackend({ request, databaseId = MOSAIC_DATABASE.id, log = () => {} }) {
  if (!expected) throw new Error('Bucket List table missing from manifest');
  let existing;
  try { existing = await request('GET', '/tablesdb/' + databaseId + '/tables/bucket_list_items'); }
  catch (error) { if (Number(error?.status) !== 404) throw error; }
  if (!existing) {
    log('Creating Bucket List table');
    await request('POST', '/tablesdb/' + databaseId + '/tables', {
      tableId: expected.id, name: expected.name, permissions: expected.permissions,
      rowSecurity: expected.rowSecurity, enabled: expected.enabled,
      columns: expected.columns, indexes: expected.indexes,
    });
    return { created: true };
  }
  const permissions = existing.$permissions ?? existing.permissions ?? [];
  if (existing.$id !== expected.id || !existing.rowSecurity || existing.enabled === false ||
      JSON.stringify([...permissions].sort()) !== JSON.stringify([...expected.permissions].sort())) throw new Error('Bucket List permission drift');
  const fields = new Map((existing.columns ?? []).map(col => [col.key, col]));
  for (const field of expected.columns) {
    const actual = fields.get(field.key);
    if (!actual || actual.type !== field.type || actual.required !== field.required ||
        (field.size && actual.size !== field.size) ||
        (Object.hasOwn(field, 'default') && actual.default !== field.default)) throw new Error('Bucket List column drift: ' + field.key);
  }
  const indexes = new Map((existing.indexes ?? []).map(index => [index.key, index]));
  for (const index of expected.indexes) {
    const actual = indexes.get(index.key);
    if (!actual || actual.type !== index.type ||
        JSON.stringify(actual.attributes ?? actual.columns) !== JSON.stringify(index.attributes)) throw new Error('Bucket List index drift: ' + index.key);
  }
  return { created: false };
}
