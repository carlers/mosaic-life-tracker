import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'bug_reports');

export async function migrateBugReportsBackend({
  request, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  if (!expected) throw new Error('Bug report table missing from manifest');
  const base = '/tablesdb/' + databaseId + '/tables';
  const path = base + '/' + expected.id;
  let actual;
  try { actual = await request('GET', path); }
  catch (cause) { if (Number(cause?.status) !== 404) throw cause; }
  if (!actual) {
    log('Creating private bug report table');
    await request('POST', base, {
      tableId: expected.id, name: expected.name,
      permissions: expected.permissions, rowSecurity: expected.rowSecurity,
      enabled: expected.enabled, columns: expected.columns, indexes: expected.indexes,
    });
    return { created: true };
  }
  const perms = actual.$permissions ?? actual.permissions ?? [];
  if (actual.$id !== expected.id || actual.rowSecurity !== true ||
      actual.enabled === false || JSON.stringify([...perms].sort()) !==
      JSON.stringify([...expected.permissions].sort())) {
    throw new Error('Private bug report table permissions differ from the manifest');
  }
  const columns = new Map((actual.columns || []).map(column => [column.key, column]));
  for (const field of expected.columns.filter(column => !column.key.startsWith('github_'))) {
    const present = columns.get(field.key);
    if (!present || present.type !== field.type || present.required !== field.required ||
        (Object.hasOwn(field, 'size') && present.size !== field.size)) {
      throw new Error('Bug report column drift: ' + field.key);
    }
  }
  const indexes = new Map((actual.indexes || []).map(index => [index.key, index]));
  for (const index of expected.indexes) {
    const present = indexes.get(index.key);
    if (!present || present.type !== index.type ||
        JSON.stringify(present.attributes ?? present.columns) !== JSON.stringify(index.attributes)) {
      throw new Error('Bug report index drift: ' + index.key);
    }
  }
  return { created: false };
}
