import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'task_shares');

export async function migrateTaskSharesBackend({
  request, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  if (!expected) throw new Error('Missing task_shares manifest');
  const tablePath = '/tablesdb/' + databaseId + '/tables/task_shares';
  let existing;
  try {
    existing = await request('GET', tablePath);
  } catch (error) {
    if (Number(error?.status) !== 404) throw error;
  }
  if (!existing) {
    log('Creating server-owned shared-task membership table...');
    await request('POST', '/tablesdb/' + databaseId + '/tables', {
      tableId: expected.id, name: expected.name, permissions: expected.permissions,
      rowSecurity: expected.rowSecurity, enabled: expected.enabled,
      columns: expected.columns, indexes: expected.indexes,
    });
    return { created: true };
  }
  const permissions = existing.$permissions ?? existing.permissions ?? [];
  if (existing.$id !== expected.id || existing.rowSecurity !== true ||
      existing.enabled === false || !Array.isArray(permissions) || permissions.length) {
    throw new Error('Incompatible shared-task membership table permissions');
  }
  const columns = new Map((existing.columns || []).map(c => [c.key, c]));
  for (const column of expected.columns) {
    const actual = columns.get(column.key);
    if (!actual || actual.type !== column.type || actual.required !== column.required ||
        (column.size && actual.size !== column.size) ||
        (Object.hasOwn(column, 'default') && actual.default !== column.default)) {
      throw new Error('Incompatible shared-task membership column: ' + column.key);
    }
  }
  const indexes = new Map((existing.indexes || []).map(i => [i.key, i]));
  for (const index of expected.indexes) {
    const actual = indexes.get(index.key);
    if (!actual || actual.type !== index.type ||
        JSON.stringify(actual.attributes ?? actual.columns) !== JSON.stringify(index.attributes)) {
      throw new Error('Incompatible shared-task membership index: ' + index.key);
    }
  }
  return { created: false };
}
