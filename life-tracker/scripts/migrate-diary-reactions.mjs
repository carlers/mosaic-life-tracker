import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
const expected = MOSAIC_TABLES.find(table => table.id === 'diary_reactions');
export async function migrateDiaryReactionsBackend({ request, log = () => {} }) {
  if (!expected) throw new Error('Diary reactions table missing from manifest');
  const base = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables';
  let existing;
  try { existing = await request('GET', base + '/diary_reactions'); }
  catch (error) { if (Number(error?.status) !== 404) throw error; }
  if (!existing) {
    log('Creating server-owned diary reaction ledger');
    await request('POST', base, {
      tableId: expected.id, name: expected.name, permissions: expected.permissions,
      rowSecurity: expected.rowSecurity, enabled: expected.enabled,
      columns: expected.columns, indexes: expected.indexes,
    });
    return { created: true };
  }
  const permissions = existing.$permissions ?? existing.permissions ?? [];
  if (existing.$id !== expected.id || !existing.rowSecurity || existing.enabled === false ||
      permissions.length !== 0) throw new Error('Diary reactions permissions drift');
  const fields = new Map((existing.columns ?? []).map(col => [col.key, col]));
  for (const expectedField of expected.columns) {
    const actual = fields.get(expectedField.key);
    if (!actual || actual.type !== expectedField.type || actual.required !== expectedField.required ||
       (expectedField.size && actual.size !== expectedField.size) ||
       (Object.hasOwn(expectedField, 'default') && actual.default !== expectedField.default))
      throw new Error('Diary reaction column drift: ' + expectedField.key);
  }
  const indexes = new Map((existing.indexes ?? []).map(index => [index.key, index]));
  for (const expectedIndex of expected.indexes) {
    const actual = indexes.get(expectedIndex.key);
    if (!actual || actual.type !== expectedIndex.type ||
      JSON.stringify(actual.attributes ?? actual.columns) !== JSON.stringify(expectedIndex.attributes))
      throw new Error('Diary reaction index drift: ' + expectedIndex.key);
  }
  return { created: false };
}
