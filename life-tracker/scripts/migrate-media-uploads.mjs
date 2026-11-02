import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'media_uploads');

export async function migrateMediaUploadsBackend({
  request, databaseId = MOSAIC_DATABASE.id, log = () => {},
}) {
  if (!expected) throw new Error('Missing media_uploads backend manifest');
  const base = '/tablesdb/' + databaseId + '/tables';
  let existing;
  try { existing = await request('GET', base + '/media_uploads'); }
  catch (error) { if (Number(error?.status) !== 404) throw error; }
  if (!existing) {
    log('Creating private server-owned media upload provenance table');
    await request('POST', base, {
      tableId: expected.id, name: expected.name, permissions: [],
      rowSecurity: true, enabled: true,
      columns: expected.columns, indexes: expected.indexes,
    });
    return { created: true };
  }
  const permissions = existing.$permissions ?? existing.permissions ?? [];
  if (existing.$id !== expected.id || existing.rowSecurity !== true ||
      existing.enabled === false || !Array.isArray(permissions) ||
      permissions.length !== 0) throw new Error('Media provenance table permissions drift');
  const fields = new Map((existing.columns || []).map(col => [col.key, col]));
  for (const field of expected.columns.filter(column => !['delete_requested_at','delete_token_hash','deleted_at','delete_receipt'].includes(column.key))) {
    const actual = fields.get(field.key);
    if (!actual || actual.type !== field.type || actual.required !== field.required ||
        (field.size && actual.size !== field.size)) {
      throw new Error('Media provenance column drift: ' + field.key);
    }
  }
  const indexes = new Map((existing.indexes || []).map(index => [index.key, index]));
  for (const index of expected.indexes) {
    const actual = indexes.get(index.key);
    if (!actual || actual.type !== index.type ||
        JSON.stringify(actual.attributes ?? actual.columns) !== JSON.stringify(index.attributes)) {
      throw new Error('Media provenance index drift: ' + index.key);
    }
  }
  return { created: false };
}
